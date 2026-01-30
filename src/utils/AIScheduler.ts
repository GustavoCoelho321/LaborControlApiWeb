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
    
    // Fluxo de volume entre processos
    let chainInputFlow: number[][] = weekData.map(() => Array(24).fill(0));

    // 1. Inicializa Inbound (Chegada Linear)
    weekData.forEach((day, dIdx) => {
        const hourlyVolume = day.volume / 24; 
        for(let h=0; h<24; h++) {
            chainInputFlow[dIdx][h] = hourlyVolume;
        }
    });

    // 2. Processamento em Cadeia
    processes.forEach((proc, pIdx) => {
        const procName = proc.name.toLowerCase();
        const isReceiving = procName.includes('recebimento') || procName.includes('inbound');
        const isPutAway = procName.includes('putway') || procName.includes('armazenagem');
        const isPicking = procName.includes('pick') || procName.includes('separação');
        const isOutbound = proc.type === 'Outbound';

        // --- CÁLCULO BASE (MÉDIA DE HC) ---
        let totalVolumeToProcess = 0;
        let totalEffectiveHours = 0;

        weekData.forEach((day, dIdx) => {
            const settings = day.parentSettings[proc.id] || { split: 100 };
            const splitRatio = settings.split / 100;

            for(let h=0; h<24; h++) {
                totalVolumeToProcess += (chainInputFlow[dIdx][h] * splitRatio);
            }

            for(let h=0; h<24; h++) {
                if (dIdx === 6 && h >= 14) continue; 
                const eff = (day.efficiencyMatrix[h] ?? 100) / 100;
                totalEffectiveHours += eff;
            }
        });

        // Fator de Segurança na Média: Picking precisa de mais gordura para não represar
        const safetyFactor = isPicking ? 1.10 : 1.02; 

        let baseHc = 0;
        if (proc.standardProductivity > 0 && totalEffectiveHours > 0) {
            baseHc = Math.ceil((totalVolumeToProcess * safetyFactor) / (proc.standardProductivity * totalEffectiveHours));
        }

        // --- SIMULAÇÃO HORA A HORA ---
        let currentBacklog = 0;

        weekData.forEach((day, dIdx) => {
            const settings = day.parentSettings[proc.id] || { split: 100 };
            const splitRatio = settings.split / 100;

            for(let h=0; h<24; h++) {
                const input = chainInputFlow[dIdx][h] * splitRatio;
                
                const limitHc = this.getHcLimit(day, h);
                const efficiencyVal = day.efficiencyMatrix[h] ?? 100;
                const efficiencyFactor = efficiencyVal / 100;

                let suggestedHc = 0;

                // Regras de Bloqueio (Domingo / Hora Morta)
                if ((dIdx === 6 && h >= 14) || efficiencyVal < 10) {
                    suggestedHc = 0;
                }
                else if (isReceiving) {
                    // RECEBIMENTO: Tenta zerar tudo na hora (Just-in-Time)
                    const targetOutput = input + currentBacklog;
                    if (proc.standardProductivity > 0) {
                        suggestedHc = Math.ceil(targetOutput / (proc.standardProductivity * efficiencyFactor));
                    }
                } 
                else {
                    // OUTBOUND & PUTWAY: Lógica de Teto Rígido
                    suggestedHc = baseHc;

                    // Definição de Teto de Backlog Local
                    let localBacklogCap = 130000; // Padrão

                    if (isPutAway) {
                        localBacklogCap = 60000;
                    } else if (isPicking) {
                        // O Picking é crítico. Ele NÃO PODE usar os 130k inteiros.
                        // Ele deve ser limitado a ~65% do global (85k) para forçar contratação
                        // se a fila começar a crescer, evitando a bola de neve de 300k.
                        localBacklogCap = 85000; 
                    }

                    // Projeção: Quanto vai sobrar de backlog com o HC atual?
                    const projectedCapacity = baseHc * proc.standardProductivity * efficiencyFactor;
                    const projectedBacklog = (currentBacklog + input) - projectedCapacity;

                    // Se a projeção estourar o teto local, AUMENTA O HC
                    if (projectedBacklog > localBacklogCap) {
                        const excess = projectedBacklog - localBacklogCap;
                        
                        // Cálculo de HC Extra necessário para matar o excesso
                        // Multiplicador de Agressividade (1.2) para garantir que baixe rápido
                        const aggressiveFactor = 1.2; 
                        const extraHcNeeded = Math.ceil((excess * aggressiveFactor) / (proc.standardProductivity * efficiencyFactor));
                        
                        suggestedHc += extraHcNeeded;
                    }
                }

                // Aplicação do Limite do Usuário (Se definido no card)
                if (limitHc > 0 && suggestedHc > limitHc) {
                    suggestedHc = limitHc;
                }

                // Salva HC
                newHcMatrix[`P-${proc.id}-${h}-${dIdx}`] = suggestedHc;

                // Calcula Resultados Reais
                const capacity = suggestedHc * proc.standardProductivity * efficiencyFactor;
                const totalAvailable = input + currentBacklog;
                const realOutput = Math.min(totalAvailable, capacity);
                const finalBacklog = Math.max(0, totalAvailable - realOutput);

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

                // Passa para frente
                currentBacklog = finalBacklog;
                chainInputFlow[dIdx][h] = realOutput;
            }
        });
    });

    return newHcMatrix;
  }
}