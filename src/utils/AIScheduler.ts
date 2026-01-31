// src/utils/AIScheduler.ts

// --- CONSTANTES DE NEGÓCIO ---
const SLA_INBOUND_HOURS = 4;   // Meta: Armazenar tudo em até 4h
const SLA_OUTBOUND_HOURS = 18; // Meta: Expedir em até 18h após picking

// MATRIZ DE CONSOLIDAÇÃO (Importante para o cálculo de input real)
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
    
    // Mapeamento de IDs
    let pickingId: number | null = null;
    const sortingIds: number[] = [];
    
    processes.forEach(p => {
        const name = p.name.toLowerCase();
        outputsByProcess[p.id] = weekData.map(() => Array(24).fill(0));
        if (name.includes('picking') || name.includes('separação')) pickingId = p.id;
        if (name.includes('sort') || name.includes('classificação')) sortingIds.push(p.id);
    });

    // 1. CÁLCULO DE MÉDIAS SEMANAIS (Base Line)
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

    // 2. SIMULAÇÃO HORA A HORA COM SLA ENFORCEMENT
    const runningBacklogs: Record<number, number> = {};
    processes.forEach(p => runningBacklogs[p.id] = 0);

    weekData.forEach((day, dIdx) => {
        const hoursArray = Array.from({ length: 24 }, (_, i) => (day.shiftStart + i) % 24);
        
        hoursArray.forEach(h => {
            
            // Monitoramento de SLA Outbound (Cadeia completa)
            let totalOutboundBacklog = 0;
            processes.forEach(p => {
                if (p.type === 'Outbound') totalOutboundBacklog += runningBacklogs[p.id];
            });

            // Backlog específico do Picking (para controle de fluxo)
            const pickingBacklog = pickingId ? runningBacklogs[pickingId] : 0;

            processes.forEach((proc, pIdx) => {
                const procName = proc.name.toLowerCase();
                const isReceiving = procName.includes('recebimento');
                const isPutAway = procName.includes('putway') || procName.includes('armazenagem');
                const isPicking = proc.id === pickingId;
                const isSorting = sortingIds.includes(proc.id);
                const isPacking = procName.includes('packing');
                const isHandover = procName.includes('handover') || procName.includes('expedição') || procName.includes('last mile');

                const settings = day.parentSettings[proc.id] || { split: 100 };
                const splitRatio = settings.split / 100;

                // --- 2.1 CÁLCULO DE INPUT ---
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

                // --- 2.2 INTELIGÊNCIA DE HC COM SLA ---
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
                    if (proc.standardProductivity > 0) {
                        suggestedHc = Math.ceil(totalLoad / (proc.standardProductivity * efficiencyFactor));
                    }
                }
                else {
                    // A. HC Base (Cruzeiro)
                    let baseHc = 0;
                    if (processTotalHours[proc.id] > 0 && proc.standardProductivity > 0) {
                        baseHc = Math.ceil(processTotalVolume[proc.id] / (proc.standardProductivity * processTotalHours[proc.id]));
                    }

                    // B. CÁLCULO DE HC PARA CUMPRIR SLA (NOVIDADE)
                    let slaHc = 0;

                    if (isPutAway && proc.standardProductivity > 0) {
                        // SLA INBOUND: Deve limpar o backlog em SLA_INBOUND_HOURS (4h)
                        // Fórmula: Carga_Atual / 4h = Qtd por hora necessária
                        const neededThroughput = totalLoad / SLA_INBOUND_HOURS;
                        slaHc = Math.ceil(neededThroughput / (proc.standardProductivity * efficiencyFactor));
                    } 
                    else if (proc.type === 'Outbound' && proc.standardProductivity > 0) {
                        // SLA OUTBOUND: A cadeia toda deve limpar em 18h.
                        // Aplicamos pressão proporcional nos processos finais (Packing/Handover)
                        // para garantir que eles "puxem" o volume.
                        
                        // Se for Handover, ele é o goleiro. Se o backlog total está alto, ele precisa acelerar.
                        if (isHandover || isPacking) {
                            const neededThroughput = totalOutboundBacklog / SLA_OUTBOUND_HOURS;
                            slaHc = Math.ceil(neededThroughput / (proc.standardProductivity * efficiencyFactor));
                        }
                    }

                    // C. Definição do HC Sugerido (Maior valor vence)
                    suggestedHc = Math.max(baseHc, slaHc);

                    // D. Teto de Backlog (Segurança Adicional)
                    if (isPutAway && currentBacklog > 50000) suggestedHc *= 1.2; // Acelera se passar de 50k
                    if (totalOutboundBacklog > 120000 && proc.type === 'Outbound') suggestedHc *= 1.2;

                    // E. Balanceamento (Válvula de Alívio)
                    // Se o Picking está morrendo (Backlog > 40k), o PutAway tira o pé, 
                    // DESDE QUE o PutAway esteja dentro do SLA seguro (Backlog < 30k)
                    if (isPutAway) {
                        if (pickingBacklog > 40000 && currentBacklog < 30000) {
                            suggestedHc = Math.floor(suggestedHc * 0.7); // Reduz 30%
                        }
                    }

                    // F. Anti-Ociosidade
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
                
                // Válvula Física: Se Picking explodiu, Putaway trava fisicamente a saída
                if (isPutAway && pickingBacklog > 50000) {
                     // Limita output para não piorar o picking, mesmo tendo gente
                     finalCapacity = Math.min(finalCapacity, 2500); 
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

            }); // Fim Processos
        }); // Fim Horas
    }); // Fim Dias

    return newHcMatrix;
  }
}