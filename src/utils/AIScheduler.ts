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
    
    // Armazena o OUTPUT REAL de cada processo para ser consultado pelos posteriores
    // Map<ProcessID, Matriz[Dia][Hora]>
    const outputsByProcess: Record<number, number[][]> = {};

    // Acumulador Global de Backlog para Outbound
    let outboundBacklogAccumulator: number[][] = weekData.map(() => Array(24).fill(0));

    // Identificação de IDs Chave para o Fluxo (Picking, Sorting, Packing)
    let pickingId: number | null = null;
    const sortingIds: number[] = [];
    
    processes.forEach(p => {
        const name = p.name.toLowerCase();
        // Inicializa matriz de output zerada para cada processo
        outputsByProcess[p.id] = weekData.map(() => Array(24).fill(0));

        if (name.includes('picking') || name.includes('separação')) pickingId = p.id;
        if (name.includes('sort') || name.includes('classificação')) sortingIds.push(p.id);
    });

    // 2. Processa cada etapa da cadeia NA ORDEM
    processes.forEach((proc, pIdx) => {
        const procName = proc.name.toLowerCase();
        const isReceiving = procName.includes('recebimento') || procName.includes('inbound');
        const isPutAway = procName.includes('putway') || procName.includes('armazenagem');
        const isPicking = proc.id === pickingId;
        const isSorting = sortingIds.includes(proc.id);
        const isPacking = procName.includes('packing') || procName.includes('embalagem');
        const isOutbound = proc.type === 'Outbound';
        
        // --- CÁLCULO DA BASE DE HC (Média) ---
        let totalVolumeToProcess = 0;
        let totalEffectiveHours = 0;

        weekData.forEach((day, dIdx) => {
            // Definição do INPUT TOTAL do dia para a média
            const settings = day.parentSettings[proc.id] || { split: 100 };
            const splitRatio = settings.split / 100;

            for(let h=0; h<24; h++) {
                let inputVal = 0;

                if (isReceiving || pIdx === 0) {
                    inputVal = day.volume / 24; // Inbound linear
                } 
                else if (isSorting && pickingId) {
                    // Sorting recebe do Picking * Split Share
                    inputVal = outputsByProcess[pickingId][dIdx][h] * splitRatio;
                }
                else if (isPacking) {
                    // Packing recebe a SOMA de todos os Sortings (Merge)
                    let totalSortOutput = 0;
                    sortingIds.forEach(sId => {
                        totalSortOutput += outputsByProcess[sId][dIdx][h];
                    });
                    inputVal = totalSortOutput; // Packing pega 100% da soma
                }
                else {
                    // Fluxo padrão linear (processo anterior)
                    const prevId = processes[pIdx - 1].id;
                    inputVal = outputsByProcess[prevId][dIdx][h] * splitRatio;
                }
                
                totalVolumeToProcess += inputVal;
            }

            for(let h=0; h<24; h++) {
                if (dIdx === 6 && h >= 14) continue; 
                const eff = (day.efficiencyMatrix[h] ?? 100) / 100;
                totalEffectiveHours += eff;
            }
        });

        const safetyFactor = isPicking ? 1.15 : 1.02; 
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
                // 1. DEFINIÇÃO DO INPUT EXATA (MESMA LÓGICA ACIMA)
                let input = 0;
                if (isReceiving || pIdx === 0) {
                    input = day.volume / 24;
                } else if (isSorting && pickingId) {
                    input = outputsByProcess[pickingId][dIdx][h] * splitRatio; // Split do Picking
                } else if (isPacking) {
                    let totalSortOutput = 0;
                    sortingIds.forEach(sId => {
                        totalSortOutput += outputsByProcess[sId][dIdx][h];
                    });
                    input = totalSortOutput; // Merge dos Sortings
                } else {
                    const prevId = processes[pIdx - 1].id;
                    input = outputsByProcess[prevId][dIdx][h] * splitRatio;
                }
                
                // 2. Parâmetros
                const limitHc = this.getHcLimit(day, h);
                const efficiencyVal = day.efficiencyMatrix[h] ?? 100;
                const efficiencyFactor = efficiencyVal / 100;

                let suggestedHc = 0;

                // --- REGRAS DE DECISÃO ---
                if ((dIdx === 6 && h >= 14) || efficiencyVal < 10) {
                    suggestedHc = 0;
                }
                else if (efficiencyVal < 90) {
                    suggestedHc = baseHc; // Mantém base na refeição
                }
                else if (isReceiving) {
                    const targetOutput = input + currentBacklog;
                    if (proc.standardProductivity > 0) {
                        suggestedHc = Math.ceil(targetOutput / (proc.standardProductivity * efficiencyFactor));
                    }
                }
                else {
                    suggestedHc = baseHc;
                    
                    let safeBacklogCeiling = 130000;
                    if (isPutAway) safeBacklogCeiling = 60000;
                    else if (isPicking) safeBacklogCeiling = 80000;

                    const potentialCapacity = baseHc * proc.standardProductivity * efficiencyFactor;
                    const projectedBacklog = (currentBacklog + input) - potentialCapacity;

                    if (projectedBacklog > safeBacklogCeiling) {
                        const excessVolume = projectedBacklog - safeBacklogCeiling;
                        const catchUpHc = Math.ceil(excessVolume / (proc.standardProductivity * efficiencyFactor));
                        suggestedHc += catchUpHc;
                    }
                }

                // 3. Limites Finais
                if (limitHc > 0 && suggestedHc > limitHc) {
                    suggestedHc = limitHc;
                }

                newHcMatrix[`P-${proc.id}-${h}-${dIdx}`] = suggestedHc;

                // 4. Resultados Reais
                const capacity = suggestedHc * proc.standardProductivity * efficiencyFactor;
                const totalAvailable = input + currentBacklog;
                const realOutput = Math.min(totalAvailable, capacity);
                const finalBacklog = Math.max(0, totalAvailable - realOutput);

                // SALVA OUTPUT PARA OS PRÓXIMOS PROCESSOS LEREM
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

                if (isOutbound) {
                    outboundBacklogAccumulator[dIdx][h] += finalBacklog;
                }

                currentBacklog = finalBacklog;
            }
        });
    });

    return newHcMatrix;
  }
}