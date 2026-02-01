import { learningService } from '../Services/LearningService';

// --- CONSTANTES DE NEGÓCIO ---
const SLA_INBOUND_HOURS = 4;   // Tempo máximo de vida do backlog de entrada
const SLA_OUTBOUND_HOURS = 18; // Tempo máximo de vida no sistema de saída
const PICKING_WARNING_THRESHOLD = 25000; // Começa a acelerar
const PICKING_CRITICAL_THRESHOLD = 30000; // Alerta vermelho (Trava)

// MATRIZ DE CONSOLIDAÇÃO
const CONSOLIDATION_MATRIX: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 70, 70, 70, 70, 70, 70, 167, 115, 106, 94], // Seg
  [65, 76, 61, 56, 57, 58, 59, 69, 62, 63, 64, 64, 64, 65, 67, 68, 69, 70, 71, 72, 74, 77, 78, 115], // Ter
  [123, 119, 120, 116, 106, 99, 95, 92, 93, 93, 95, 95, 97, 98, 100, 102, 103, 105, 106, 107, 109, 112, 116, 120], // Qua
  [89, 93, 93, 94, 93, 94, 95, 96, 99, 102, 104, 108, 108, 109, 111, 113, 116, 118, 118, 120, 122, 123, 123, 121], // Qui
  [89, 92, 92, 94, 96, 97, 98, 101, 102, 102, 103, 103, 112, 104, 105, 107, 109, 111, 112, 113, 115, 116, 114, 112], // Sex
  [88, 91, 96, 96, 98, 95, 94, 98, 100, 101, 101, 102, 102, 103, 105, 108, 110, 111, 112, 113, 115, 115, 115, 181], // Sab
  [125, 126, 124, 127, 137, 138, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // Dom
];

export interface AIProcessInput {
  id: number;
  name: string;
  type: 'Inbound' | 'Outbound'; 
  standardProductivity: number;
  efficiency?: number; 
  travelTime?: number; 
  subprocesses: { 
      id: number; 
      standardProductivity: number;
      efficiency?: number;
      travelTime?: number;
  }[];
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

  static calculateSchedule(weekData: AIDayData[], processes: AIProcessInput[]) {
    const newHcMatrix: Record<string, number> = {};
    const outputsByProcess: Record<number, number[][]> = {};
    
    // Identificação de IDs críticos
    let pickingId: number | null = null;
    const sortingIds: number[] = [];
    
    processes.forEach(p => {
        outputsByProcess[p.id] = weekData.map(() => Array(24).fill(0));
        const name = p.name.toLowerCase();
        if (name.includes('picking') || name.includes('separação')) pickingId = p.id;
        if (name.includes('sort') || name.includes('classificação')) sortingIds.push(p.id);
    });

    const runningBacklogs: Record<number, number> = {};
    processes.forEach(p => runningBacklogs[p.id] = 0);

    // ========================================================================
    // LOOP PRINCIPAL DE SIMULAÇÃO
    // ========================================================================
    weekData.forEach((day, dIdx) => {
        const hoursArray = Array.from({ length: 24 }, (_, i) => (day.shiftStart + i) % 24);
        
        hoursArray.forEach(h => {
            
            // --- SLA SYSTEM CHECK ---
            let totalSystemOutboundBacklog = 0;
            processes.forEach(p => {
                if (p.type === 'Outbound') totalSystemOutboundBacklog += runningBacklogs[p.id];
            });
            const pickingBacklog = pickingId ? runningBacklogs[pickingId] : 0;

            processes.forEach((proc, pIdx) => {
                const procName = proc.name.toLowerCase();
                const isReceiving = procName.includes('recebimento');
                const isPutAway = procName.includes('putway') || procName.includes('armazenagem');
                const isPicking = proc.id === pickingId;
                const isSorting = sortingIds.includes(proc.id);
                const isPacking = procName.includes('packing') || procName.includes('embalagem');
                const isHandover = procName.includes('handover') || procName.includes('expedição') || procName.includes('last mile');

                const settings = day.parentSettings[proc.id] || { split: 100 };
                const splitRatio = settings.split / 100;

                // 1. INPUT
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

                // 2. PRODUTIVIDADE
                const matrixFactor = (day.efficiencyMatrix[h] ?? 100) / 100;
                const procEff = proc.efficiency ?? 1; 
                const travelMinutes = proc.travelTime ?? 0;
                const netTimeFactor = Math.max(0.1, (60 - travelMinutes) / 60);
                const effectiveProd = proc.standardProductivity * procEff * netTimeFactor * matrixFactor;

                // 3. INTELIGÊNCIA
                const currentBacklog = runningBacklogs[proc.id];
                const totalLoad = input + currentBacklog;
                let suggestedHc = 0;

                if ((dIdx === 6 && h >= 14) || matrixFactor < 0.1) {
                    suggestedHc = 0;
                } 
                else if (effectiveProd > 0) {
                    // A. Matemática Base
                    let mathHc = Math.ceil(input / effectiveProd);
                    let backlogRecoveryHc = 0;

                    // B. SLA Logic (Pressure)
                    if (isPutAway) {
                        const hoursAccumulated = currentBacklog / effectiveProd;
                        if (hoursAccumulated > (SLA_INBOUND_HOURS / 2)) {
                            backlogRecoveryHc = Math.ceil((currentBacklog / 2) / effectiveProd);
                        } else {
                            backlogRecoveryHc = Math.ceil((currentBacklog / SLA_INBOUND_HOURS) / effectiveProd);
                        }
                    } 
                    else if (proc.type === 'Outbound') {
                        if (isHandover || isPacking) {
                            const avgThroughput = 5000;
                            const systemHoursBacklog = totalSystemOutboundBacklog / avgThroughput;
                            if (systemHoursBacklog > 10) backlogRecoveryHc = Math.ceil((currentBacklog / 3) / effectiveProd);
                            else backlogRecoveryHc = Math.ceil((currentBacklog / 6) / effectiveProd);
                        }
                        if (isPicking) {
                            if (currentBacklog > PICKING_CRITICAL_THRESHOLD) backlogRecoveryHc = Math.ceil((currentBacklog / 4) / effectiveProd); 
                            else if (currentBacklog > PICKING_WARNING_THRESHOLD) backlogRecoveryHc = Math.ceil((currentBacklog / 6) / effectiveProd);
                            else backlogRecoveryHc = Math.ceil((currentBacklog / 12) / effectiveProd);
                        }
                    }

                    mathHc = Math.max(mathHc, backlogRecoveryHc);

                    // C. Consulta à IA (Com Contexto de Dia e Turno)
                    const learnedHc = learningService.predict(
                        proc.id, 
                        totalLoad, 
                        h, 
                        dIdx,           // <--- Dia da semana
                        day.shiftStart  // <--- Início do turno
                    );

                    if (learnedHc !== null && learnedHc >= 0) {
                         // Fusão: A IA tem peso alto (80%) porque agora ela entende o contexto
                         suggestedHc = Math.ceil((learnedHc * 0.8) + (mathHc * 0.2));
                         
                         if (suggestedHc < mathHc * 0.5) suggestedHc = mathHc;
                    } else {
                         suggestedHc = mathHc;
                    }

                    // D. Anti-Ociosidade
                    if (suggestedHc * effectiveProd > totalLoad) {
                        suggestedHc = Math.ceil(totalLoad / effectiveProd);
                    }
                }

                // E. Limites
                const limitUserHc = this.getHcLimit(day, h);
                if (limitUserHc > 0 && suggestedHc > limitUserHc) {
                    suggestedHc = limitUserHc;
                }

                newHcMatrix[`P-${proc.id}-${h}-${dIdx}`] = suggestedHc;

                // 4. OUTPUT
                let finalCapacity = suggestedHc * effectiveProd;
                // Trava de Segurança
                if (isPutAway && pickingBacklog > PICKING_CRITICAL_THRESHOLD) {
                    finalCapacity = finalCapacity * 0.5;
                }

                const realOutput = Math.min(totalLoad, finalCapacity);
                const newBacklog = Math.max(0, totalLoad - realOutput);

                outputsByProcess[proc.id][dIdx][h] = realOutput;
                runningBacklogs[proc.id] = newBacklog;

                // 5. SUBPROCESSOS
                if (proc.subprocesses) {
                    proc.subprocesses.forEach(sub => {
                        const subEff = sub.efficiency ?? 1;
                        const subTravel = sub.travelTime ?? 0;
                        const subNetTime = Math.max(0.1, (60 - subTravel) / 60);
                        const subEffectiveProd = sub.standardProductivity * subEff * subNetTime * matrixFactor;

                        let subHc = 0;
                        if (subEffectiveProd > 0 && realOutput > 0) {
                            subHc = Math.ceil(realOutput / subEffectiveProd);
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