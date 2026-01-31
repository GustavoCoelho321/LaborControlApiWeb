// src/utils/AIScheduler.ts

// MATRIZ DE CONSOLIDAÇÃO
const CONSOLIDATION_MATRIX: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 70, 70, 70, 70, 70, 70, 167, 115, 106, 94],
  [65, 76, 61, 56, 57, 58, 59, 69, 62, 63, 64, 64, 64, 65, 67, 68, 69, 70, 71, 72, 74, 77, 78, 115],
  [123, 119, 120, 116, 106, 99, 95, 92, 93, 93, 95, 95, 97, 98, 100, 102, 103, 105, 106, 107, 109, 112, 116, 120],
  [89, 93, 93, 94, 93, 94, 95, 96, 99, 102, 104, 108, 108, 109, 111, 113, 116, 118, 118, 120, 122, 123, 123, 121],
  [89, 92, 92, 94, 96, 97, 98, 101, 102, 102, 103, 103, 112, 104, 105, 107, 109, 111, 112, 113, 115, 116, 114, 112],
  [88, 91, 96, 96, 98, 95, 94, 98, 100, 101, 101, 102, 102, 103, 105, 108, 110, 111, 112, 113, 115, 115, 115, 181],
  [125, 126, 124, 127, 137, 138, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

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
    if (hour >= 6 && hour < 14) return 1;
    if (hour >= 14 && hour < 22) return 2;
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
    const outputsByProcess: Record<number, number[][]> = {};
    
    // Identificação de IDs e Fluxo
    let pickingId: number | null = null;
    const sortingIds: number[] = [];
    
    processes.forEach(p => {
        const name = p.name.toLowerCase();
        outputsByProcess[p.id] = weekData.map(() => Array(24).fill(0));
        if (name.includes('picking') || name.includes('separação')) pickingId = p.id;
        if (name.includes('sort') || name.includes('classificação')) sortingIds.push(p.id);
    });

    // 1. PRÉ-CÁLCULO (VOLUME SEMANAL)
    const processTotalVolume: Record<number, number> = {};
    const processTotalHours: Record<number, number> = {};

    processes.forEach(proc => {
        let weeklyVol = 0;
        let weeklyHours = 0;
        const isPicking = proc.id === pickingId;

        weekData.forEach((day, dIdx) => {
            const settings = day.parentSettings[proc.id] || { split: 100 };
            const splitRatio = settings.split / 100;

            if (proc.type === 'Inbound' || processes.indexOf(proc) === 0) {
                weeklyVol += (day.volume * splitRatio);
            } else if (isPicking) {
                const dailyConsolidationSum = CONSOLIDATION_MATRIX[dIdx].reduce((a, b) => a + b, 0);
                const avgConsolidation = dailyConsolidationSum / 24 / 100;
                weeklyVol += (day.volume * avgConsolidation * splitRatio);
            } else {
                weeklyVol += (day.volume * splitRatio); 
            }

            for(let h=0; h<24; h++) {
                if (dIdx === 6 && h >= 14) continue;
                const eff = (day.efficiencyMatrix[h] ?? 100) / 100;
                if (eff > 0.5) weeklyHours += eff;
            }
        });

        processTotalVolume[proc.id] = weeklyVol;
        processTotalHours[proc.id] = weeklyHours;
    });

    // 2. SIMULAÇÃO HORA A HORA
    const runningBacklogs: Record<number, number> = {};
    processes.forEach(p => runningBacklogs[p.id] = 0);

    weekData.forEach((day, dIdx) => {
        const hoursArray = Array.from({ length: 24 }, (_, i) => (day.shiftStart + i) % 24);
        
        hoursArray.forEach(h => {
            
            // Monitor de Backlog Total de Outbound (Para o Teto de 130k)
            let currentTotalOutboundBacklog = 0;
            processes.forEach(p => {
                if (p.type === 'Outbound') currentTotalOutboundBacklog += runningBacklogs[p.id];
            });

            // Monitor específico do Picking (para o PutAway ver)
            const pickingBacklog = pickingId ? runningBacklogs[pickingId] : 0;

            processes.forEach((proc, pIdx) => {
                const procName = proc.name.toLowerCase();
                const isReceiving = procName.includes('recebimento');
                const isPutAway = procName.includes('putway') || procName.includes('armazenagem');
                const isPicking = proc.id === pickingId;
                const isSorting = sortingIds.includes(proc.id);
                const isPacking = procName.includes('packing');

                const settings = day.parentSettings[proc.id] || { split: 100 };
                const splitRatio = settings.split / 100;

                // --- 2.1 INPUT ---
                let input = 0;
                if (isReceiving) {
                    const remainingHours = 24 - day.shiftStart;
                    const hourIndexInShift = hoursArray.indexOf(h);
                    if (hourIndexInShift < remainingHours) {
                        input = day.volume / remainingHours;
                    }
                } 
                else if (isPicking) {
                    const prevProc = processes[pIdx - 1];
                    const prevOutput = outputsByProcess[prevProc.id][dIdx][h];
                    const consolidationRate = CONSOLIDATION_MATRIX[dIdx][h];
                    input = prevOutput * (consolidationRate / 100);
                }
                else if (isSorting && pickingId) {
                    input = outputsByProcess[pickingId][dIdx][h] * splitRatio;
                } else if (isPacking) {
                    let totalSort = 0;
                    sortingIds.forEach(sid => totalSort += outputsByProcess[sid][dIdx][h]);
                    input = totalSort;
                } else {
                    const prevProc = processes[pIdx - 1];
                    if (prevProc) input = outputsByProcess[prevProc.id][dIdx][h] * splitRatio;
                }

                // --- 2.2 INTELIGÊNCIA DE HC E REDISTRIBUIÇÃO ---
                const efficiencyVal = day.efficiencyMatrix[h] ?? 100;
                const efficiencyFactor = efficiencyVal / 100;
                const limitHc = this.getHcLimit(day, h);
                const currentBacklog = runningBacklogs[proc.id];
                const totalLoad = input + currentBacklog;

                let suggestedHc = 0;

                // Bloqueios
                if ((dIdx === 6 && h >= 14) || efficiencyVal < 10) {
                    suggestedHc = 0;
                }
                else if (isReceiving) {
                    // Recebimento: Just in Time
                    if (proc.standardProductivity > 0) {
                        suggestedHc = Math.ceil(totalLoad / (proc.standardProductivity * efficiencyFactor));
                    }
                }
                else {
                    // Outros processos: Cálculo Estratégico
                    let baseHc = 0;
                    if (processTotalHours[proc.id] > 0 && proc.standardProductivity > 0) {
                        baseHc = Math.ceil(processTotalVolume[proc.id] / (proc.standardProductivity * processTotalHours[proc.id]));
                    }

                    // A. Fator de Risco (Aumenta HC se backlog alto)
                    let riskFactor = 1.0;
                    
                    if (isPutAway) {
                        // Teto INBOUND: 60k
                        // Se estiver chegando perto de 60k, o PutAway TEM que trabalhar rápido para não travar a Doca
                        if (currentBacklog > 45000) riskFactor = 1.3;
                        if (currentBacklog > 55000) riskFactor = 2.0; // Pânico
                    } else if (isPicking) {
                        // Picking: Se tem muito backlog, acelera
                        if (currentBacklog > 30000) riskFactor = 1.2;
                        if (currentBacklog > 50000) riskFactor = 1.5;
                    } else if (proc.type === 'Outbound') {
                        // Teto GLOBAL OUTBOUND: 130k
                        if (currentTotalOutboundBacklog > 110000) riskFactor = 1.3;
                        if (currentTotalOutboundBacklog > 125000) riskFactor = 2.0;
                    }

                    // B. Lógica de "Válvula" (Redistribuição)
                    // Se eu sou o PutAway e o Picking está morrendo afogado, eu piso no freio
                    // DESDE QUE eu (PutAway) não esteja morrendo também.
                    if (isPutAway) {
                        const pickingIsDrowning = pickingBacklog > 40000; // Picking com 40k+ de pendência
                        const inboundIsSafe = currentBacklog < 50000; // Eu ainda tenho espaço até os 60k

                        if (pickingIsDrowning && inboundIsSafe) {
                            // REDUÇÃO ESTRATÉGICA:
                            // Reduz o HC do PutAway para gerar menos output e não inflar o Picking
                            riskFactor *= 0.5; 
                        }
                    }

                    // C. Deadline Domingo
                    if (dIdx === 6 && h < 14) {
                        const hoursLeft = 14 - h;
                        const neededToZero = Math.ceil(totalLoad / (proc.standardProductivity * efficiencyFactor * Math.max(1, hoursLeft)));
                        suggestedHc = Math.max(baseHc * riskFactor, neededToZero);
                    } else {
                        suggestedHc = Math.ceil(baseHc * riskFactor);
                    }

                    // D. Anti-Ociosidade
                    const maxPossibleOutput = suggestedHc * proc.standardProductivity * efficiencyFactor;
                    if (maxPossibleOutput > totalLoad) {
                        suggestedHc = Math.ceil(totalLoad / (proc.standardProductivity * efficiencyFactor));
                    }
                }

                // Limite do Usuário
                if (limitHc > 0 && suggestedHc > limitHc) {
                    suggestedHc = limitHc;
                }

                newHcMatrix[`P-${proc.id}-${h}-${dIdx}`] = suggestedHc;

                // --- 2.3 CALCULAR OUTPUT REAL ---
                let finalCapacity = suggestedHc * proc.standardProductivity * efficiencyFactor;
                
                // LÓGICA DE TRAVA DE OUTPUT (SEGURAR NO BACKLOG)
                // Se o PutAway tiver HC, mas o Picking estiver crítico, podemos artificialmente
                // limitar o output do PutAway (fazer o operador trabalhar mais devagar ou pausar),
                // forçando o backlog a ficar no PutAway.
                if (isPutAway) {
                     const pickingIsCritical = pickingBacklog > 50000;
                     const inboundIsSafe = currentBacklog < 55000; // Limite de segurança antes dos 60k
                     
                     if (pickingIsCritical && inboundIsSafe) {
                         // Trava o output do PutAway para enviar no máximo X peças por hora
                         // Ex: Enviar só 2000 peças/h para dar fôlego ao Picking
                         const throttleLimit = 2000; 
                         finalCapacity = Math.min(finalCapacity, throttleLimit);
                     }
                }

                const realOutput = Math.min(totalLoad, finalCapacity);
                const newBacklog = Math.max(0, totalLoad - realOutput);

                outputsByProcess[proc.id][dIdx][h] = realOutput;
                runningBacklogs[proc.id] = newBacklog;

                // Subprocessos
                if (proc.subprocesses) {
                    proc.subprocesses.forEach(sub => {
                        let subHc = 0;
                        if (sub.standardProductivity > 0 && realOutput > 0) {
                            subHc = Math.ceil(realOutput / sub.standardProductivity);
                        }
                        newHcMatrix[`S-${sub.id}-${h}-${dIdx}`] = subHc;
                    });
                }

            }); 
        }); 
    });

    return newHcMatrix;
  }
}