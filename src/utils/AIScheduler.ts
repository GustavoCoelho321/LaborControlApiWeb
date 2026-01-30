// src/utils/AIScheduler.ts

export interface AIProcessInput {
  id: number;
  name: string;
  type: 'Inbound' | 'Outbound'; 
  standardProductivity: number;
  subprocesses: { id: number; standardProductivity: number }[];
}

export interface AIDayData {
  volume: number;
  consolidation: number;
  shiftStart: number;
  limitInbound: number; 
  limitOutbound: number;
  maxHcT1: number;
  maxHcT2: number;
  maxHcT3: number;
  efficiencyMatrix: Record<number, number>;
  parentSettings: Record<number, { split: number }>;
}

export class AIScheduler {
  
  private static getShift(hour: number): 1 | 2 | 3 {
    if (hour >= 0 && hour < 8) return 1;
    if (hour >= 8 && hour < 16) return 2;
    return 3;
  }

  private static getHcLimit(day: AIDayData, hour: number): number {
    const shift = this.getShift(hour);
    if (shift === 1) return day.maxHcT1;
    if (shift === 2) return day.maxHcT2;
    return day.maxHcT3;
  }

  static calculateSchedule(
    weekData: AIDayData[],
    processes: AIProcessInput[]
  ) {
    const newHcMatrix: Record<string, number> = {};
    
    // Armazena outputs para fluxo Branch & Merge
    const outputsByProcess: Record<number, number[][]> = {};
    
    // Identificação de IDs
    let pickingId: number | null = null;
    const sortingIds: number[] = [];
    
    processes.forEach(p => {
        const name = p.name.toLowerCase();
        outputsByProcess[p.id] = weekData.map(() => Array(24).fill(0));
        if (name.includes('picking') || name.includes('separação')) pickingId = p.id;
        if (name.includes('sort') || name.includes('classificação')) sortingIds.push(p.id);
    });

    // ====================================================
    // 1. SIMULAÇÃO DE FLUXO GLOBAL (Pré-Cálculo de Volume)
    // ====================================================
    // Precisamos saber quanto volume vai passar em cada processo ANTES de decidir o HC
    // para calcular a média semanal correta.
    
    // Map<ProcessID, TotalWeeklyVolume>
    const processTotalVolume: Record<number, number> = {};
    
    // Map<ProcessID, TotalEffectiveHours> (Horas úteis até Domingo 14h)
    const processTotalHours: Record<number, number> = {};

    processes.forEach(proc => {
        let weeklyVol = 0;
        let weeklyHours = 0;

        weekData.forEach((day, dIdx) => {
            const settings = day.parentSettings[proc.id] || { split: 100 };
            const splitRatio = settings.split / 100;

            // Soma Volume Previsto (Estimativa Linear para Base)
            // Nota: Isso é uma estimativa, o real depende do output dos anteriores, 
            // mas serve para a média estratégica.
            if (proc.type === 'Inbound' || processes.indexOf(proc) === 0) {
                weeklyVol += (day.volume * splitRatio);
            } else {
                // Para processos downstream, assumimos que o volume total de entrada será processado
                // (Goal Seek: Tudo que entra, tem que sair)
                weeklyVol += (day.volume * (day.consolidation/100) * splitRatio);
            }

            // Soma Horas Úteis
            for(let h=0; h<24; h++) {
                if (dIdx === 6 && h >= 14) continue; // Domingo deadline
                const eff = (day.efficiencyMatrix[h] ?? 100) / 100;
                weeklyHours += eff;
            }
        });

        processTotalVolume[proc.id] = weeklyVol;
        processTotalHours[proc.id] = weeklyHours;
    });


    // ====================================================
    // 2. PROCESSAMENTO HORA A HORA (Execução Real)
    // ====================================================
    
    processes.forEach((proc, pIdx) => {
        const procName = proc.name.toLowerCase();
        const isReceiving = procName.includes('recebimento') || procName.includes('inbound');
        const isPutAway = procName.includes('putway') || procName.includes('armazenagem');
        const isPicking = proc.id === pickingId;
        const isSorting = sortingIds.includes(proc.id);
        const isPacking = procName.includes('packing') || procName.includes('embalagem');

        // --- CÁLCULO DO HC BASE ESTRATÉGICO (GLOBAL WEEKLY AVERAGE) ---
        // "Quantas pessoas preciso na média para zerar a semana toda?"
        let globalBaseHc = 0;
        if (proc.standardProductivity > 0 && processTotalHours[proc.id] > 0) {
            // Picking ganha mais gordura (1.10) para garantir fluxo
            const safetyFactor = isPicking ? 1.10 : 1.02;
            globalBaseHc = Math.ceil((processTotalVolume[proc.id] * safetyFactor) / (proc.standardProductivity * processTotalHours[proc.id]));
        }

        let currentProcessBacklog = 0;

        weekData.forEach((day, dIdx) => {
            const settings = day.parentSettings[proc.id] || { split: 100 };
            const splitRatio = settings.split / 100;

            for(let h=0; h<24; h++) {
                // Definição do Input (Branch & Merge)
                let input = 0;
                if (isReceiving || pIdx === 0) {
                    input = day.volume / 24;
                } else if (isSorting && pickingId) {
                    input = outputsByProcess[pickingId][dIdx][h] * splitRatio;
                } else if (isPacking) {
                    let totalSort = 0;
                    sortingIds.forEach(sid => totalSort += outputsByProcess[sid][dIdx][h]);
                    input = totalSort;
                } else {
                    const prevId = processes[pIdx - 1].id;
                    input = outputsByProcess[prevId][dIdx][h] * splitRatio;
                }

                // Parâmetros
                const limitHc = this.getHcLimit(day, h);
                const efficiencyVal = day.efficiencyMatrix[h] ?? 100;
                const efficiencyFactor = efficiencyVal / 100;

                let suggestedHc = 0;

                // --- INTELIGÊNCIA HÍBRIDA (GLOBAL TARGET + LOCAL CONSTRAINT) ---

                // 1. Bloqueios Absolutos
                if ((dIdx === 6 && h >= 14) || efficiencyVal < 10) {
                    suggestedHc = 0;
                }
                // 2. Refeição -> Mantém a Média Global (Não tenta compensar, nem zerar)
                else if (efficiencyVal < 90) {
                    suggestedHc = globalBaseHc;
                }
                // 3. Recebimento -> Just In Time (Mata o que tem)
                else if (isReceiving) {
                    const load = input + currentProcessBacklog;
                    if (proc.standardProductivity > 0) {
                        suggestedHc = Math.ceil(load / (proc.standardProductivity * efficiencyFactor));
                    }
                }
                // 4. Outbound / PutWay -> Lógica de "Cruzeiro" com Intervenção
                else {
                    // Começamos com a Média Semanal (Visão de Longo Prazo)
                    suggestedHc = globalBaseHc;

                    // Definição do Teto Seguro de Backlog (Healthy Cap)
                    let backlogCeiling = 130000;
                    if (isPutAway) backlogCeiling = 60000;
                    else if (isPicking) backlogCeiling = 85000; 

                    // Projeção Tática: "Se eu mantiver a média, estouro o teto hoje?"
                    const capacity = suggestedHc * proc.standardProductivity * efficiencyFactor;
                    const projectedBacklog = (currentProcessBacklog + input) - capacity;

                    // Se estourar teto, aumenta HC pontualmente
                    if (projectedBacklog > backlogCeiling) {
                        const excess = projectedBacklog - backlogCeiling;
                        const extra = Math.ceil((excess * 1.2) / (proc.standardProductivity * efficiencyFactor));
                        suggestedHc += extra;
                    }

                    // Otimização de Ociosidade:
                    // Se a média semanal for muito alta para o volume deste momento específico (ex: início de turno vazio),
                    // reduzimos para não ficar gente parada.
                    const totalLoad = currentProcessBacklog + input;
                    const maxCap = suggestedHc * proc.standardProductivity * efficiencyFactor;
                    
                    if (maxCap > totalLoad && totalLoad >= 0) {
                        suggestedHc = Math.ceil(totalLoad / (proc.standardProductivity * efficiencyFactor));
                    }
                }

                // 5. Limite Físico do Usuário (Sempre vence)
                if (limitHc > 0 && suggestedHc > limitHc) {
                    suggestedHc = limitHc;
                }

                // Salva
                newHcMatrix[`P-${proc.id}-${h}-${dIdx}`] = suggestedHc;

                // Resultados Reais
                const finalCapacity = suggestedHc * proc.standardProductivity * efficiencyFactor;
                const totalAvailable = input + currentProcessBacklog;
                const realOutput = Math.min(totalAvailable, finalCapacity);
                const finalBacklog = Math.max(0, totalAvailable - realOutput);

                // Output para próximos
                outputsByProcess[proc.id][dIdx][h] = realOutput;

                // Indiretos
                if (proc.subprocesses) {
                    proc.subprocesses.forEach(sub => {
                        let subHc = 0;
                        if (sub.standardProductivity > 0 && realOutput > 0) {
                            subHc = Math.ceil(realOutput / sub.standardProductivity);
                        }
                        if (suggestedHc === 0 || realOutput === 0) subHc = 0;
                        newHcMatrix[`S-${sub.id}-${h}-${dIdx}`] = subHc;
                    });
                }

                currentProcessBacklog = finalBacklog;
            }
        });
    });

    return newHcMatrix;
  }
}