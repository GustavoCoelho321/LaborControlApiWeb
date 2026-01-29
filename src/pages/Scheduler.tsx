import { useState, useEffect, useMemo } from 'react';
import { api } from '../Services/api'; 
import * as XLSX from 'xlsx'; 
import { 
  Save, Settings2, Users,
  ArrowDownCircle, ArrowUpCircle, AlertTriangle, 
  Wand2, CalendarDays, CheckCircle2,
  CornerDownRight, Clock, GripVertical, Ban, Users2, TrendingUp,
  ArrowRight, Package, Layers
} from 'lucide-react';

// --- INTERFACES ---
interface Subprocess {
  id: number;
  name: string;
  standardProductivity: number;
}

interface Process {
  id: number;
  name: string;
  type: 'Inbound' | 'Outbound';
  standardProductivity: number;
  subprocesses?: Subprocess[];
}

interface SchedulableItem {
  uniqueId: string;
  name: string;
  type: 'Inbound' | 'Outbound';
  productivity: number;
  parentId?: number;
  isChild: boolean;
}

interface SimulationCell {
  hour: number;
  input: number;      
  efficiency: number; 
  totalHc: number;    
  capacity: number;   
  output: number;     
  backlog: number;    
}

interface DayScenario {
  volume: number;
  consolidation: number;
  shiftStart: number;
  limitInbound: number; 
  limitOutbound: number;
  
  // Limites por Turno (0 = Ilimitado)
  maxHcT1: number; 
  maxHcT2: number;
  maxHcT3: number;

  hcMatrix: Record<string, number>; 
  efficiencyMatrix: Record<number, number>;
  parentSettings: Record<number, { split: number }>; 
}

const DAYS_OF_WEEK = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const DEFAULT_ORDER = [
  "Recebimento", "PutWay", "Picking", "Sorting Aut", "Sorting Manual", "Packing", "Handover Last Mile"
];

const LOW_EFFICIENCY_HOURS = [0, 1, 11, 12, 18, 19];

export function Scheduler() {
  const [loading, setLoading] = useState(false);
  const [processOrder, setProcessOrder] = useState<Process[]>([]);
  const [activeDayIndex, setActiveDayIndex] = useState(0); 
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // --- ESTADO DA SEMANA ---
  const [weekData, setWeekData] = useState<DayScenario[]>(
    Array.from({ length: 7 }, () => {
      const eff: Record<number, number> = {};
      for(let h=0; h<24; h++) {
        eff[h] = LOW_EFFICIENCY_HOURS.includes(h) ? 50 : 100;
      }
      return {
        volume: 10000, 
        consolidation: 100,
        shiftStart: 0, // Início padrão 00:00
        limitInbound: 50000,   
        limitOutbound: 130000, 
        
        // Limites de HC por turno (Padrão 0 = Ilimitado)
        maxHcT1: 0,
        maxHcT2: 0,
        maxHcT3: 0,

        hcMatrix: {},
        efficiencyMatrix: eff,
        parentSettings: {}
      };
    })
  );

  useEffect(() => {
    loadProcesses();
  }, []);

  async function loadProcesses() {
    setLoading(true);
    try {
      const response = await api.get('/processes');
      let processes: Process[] = response.data;

      processes.sort((a, b) => {
        const idxA = DEFAULT_ORDER.findIndex(name => a.name.toLowerCase().includes(name.toLowerCase()));
        const idxB = DEFAULT_ORDER.findIndex(name => b.name.toLowerCase().includes(name.toLowerCase()));
        const posA = idxA === -1 ? 999 : idxA;
        const posB = idxB === -1 ? 999 : idxB;
        return posA - posB;
      });

      setProcessOrder(processes);
      
      setWeekData(prev => prev.map(day => {
        const initialSettings: Record<number, { split: number }> = {};
        processes.forEach((p: Process) => {
           initialSettings[p.id] = { split: 100 };
        });
        return { ...day, parentSettings: initialSettings };
      }));

    } catch (error) {
      console.error("Erro ao carregar processos", error);
    } finally {
      setLoading(false);
    }
  }

  // --- HELPER: Descobrir qual turno é essa hora ---
  // Retorna 1, 2 ou 3
  const getShiftForHour = (hourIndex: number) => {
    // Como o array de horas já é gerado a partir do shiftStart, 
    // os primeiros 8 índices são sempre T1, os próximos 8 são T2, etc.
    if (hourIndex < 8) return 1;
    if (hourIndex < 16) return 2;
    return 3;
  };

  // --- ATUALIZAÇÃO DE DADOS ---
  const updateDayData = (dayIdx: number, field: keyof DayScenario, value: any) => {
    setWeekData(prev => {
      const newData = [...prev];
      newData[dayIdx] = { ...newData[dayIdx], [field]: value };
      return newData;
    });
  };

  const currentDayData = weekData[activeDayIndex];

  const updateCurrentDay = (field: keyof DayScenario, value: any) => {
    updateDayData(activeDayIndex, field, value);
  };

  const handleHcChange = (id: string, hour: number, val: string) => {
    const newMatrix = { ...currentDayData.hcMatrix, [`${id}-${hour}`]: Number(val) };
    updateCurrentDay('hcMatrix', newMatrix);
  };

  const handleEfficiencyChange = (hour: number, val: string) => {
    const newMatrix = { ...currentDayData.efficiencyMatrix, [hour]: Number(val) };
    updateCurrentDay('efficiencyMatrix', newMatrix);
  };

  const handleParentSettingChange = (procId: number, field: 'split', val: number) => {
    const newSettings = { ...currentDayData.parentSettings };
    if (!newSettings[procId]) newSettings[procId] = { split: 100 };
    newSettings[procId] = { ...newSettings[procId], [field]: val };
    updateCurrentDay('parentSettings', newSettings);
  };

  const handleDragStart = (index: number) => setDraggedItemIndex(index);
  const handleDrop = (index: number) => {
    if (draggedItemIndex === null) return;
    const newOrder = [...processOrder];
    const itemDragged = newOrder[draggedItemIndex];
    newOrder.splice(draggedItemIndex, 1);
    newOrder.splice(index, 0, itemDragged);
    setProcessOrder(newOrder);
    setDraggedItemIndex(null);
  };

  // ==================================================================================
  //  ENGINE DE CÁLCULO
  // ==================================================================================
  const weekSimulation = useMemo(() => {
    const fullWeekResults: Record<number, Record<number, SimulationCell[]>> = {};
    const daysHours: Record<number, number[]> = {};
    const daysPeakHc: Record<number, number> = {}; 
    let carryOverBacklogs: Record<number, number> = {};

    weekData.forEach((dayData, dayIdx) => {
       const dayResults: Record<number, SimulationCell[]> = {};
       const hoursArray = Array.from({ length: 24 }, (_, i) => (dayData.shiftStart + i) % 24);
       daysHours[dayIdx] = hoursArray;
       
       const hourlyTotalHc = new Array(24).fill(0);

       // Distribuição Linear Inbound 24h
       let previousProcessOutput: number[] = hoursArray.map(() => dayData.volume / 24);

       processOrder.forEach((proc, idx) => {
          const procCells: SimulationCell[] = [];
          
          let currentBacklog = carryOverBacklogs[proc.id] || 0;
          const settings = dayData.parentSettings[proc.id] || { split: 100 };
          
          const isTypeChange = idx > 0 && processOrder[idx-1].type === 'Inbound' && proc.type === 'Outbound';
          const typeMultiplier = isTypeChange ? (dayData.consolidation / 100) : 1;
          const finalMultiplier = typeMultiplier * (settings.split / 100);

          hoursArray.forEach((hour, hIdx) => {
             const input = previousProcessOutput[hIdx] * finalMultiplier;
             
             let totalHc = dayData.hcMatrix[`P-${proc.id}-${hour}`] || 0;
             if (proc.subprocesses) {
                proc.subprocesses.forEach(sub => {
                    totalHc += (dayData.hcMatrix[`S-${sub.id}-${hour}`] || 0);
                });
             }
             
             hourlyTotalHc[hIdx] += totalHc;

             const efficiency = (dayData.efficiencyMatrix[hour] ?? 100) / 100;
             const capacity = totalHc * proc.standardProductivity * efficiency;
             const totalAvailable = input + currentBacklog;
             const output = Math.min(totalAvailable, capacity);
             const newBacklog = totalAvailable - output;
             
             currentBacklog = newBacklog;

             procCells.push({ hour, input, efficiency: efficiency * 100, totalHc, capacity, output, backlog: newBacklog });
          });

          dayResults[proc.id] = procCells;
          carryOverBacklogs[proc.id] = currentBacklog;
          previousProcessOutput = procCells.map(c => c.output);
       });

       fullWeekResults[dayIdx] = dayResults;
       daysPeakHc[dayIdx] = Math.max(...hourlyTotalHc);
    });

    return { fullWeekResults, daysHours, daysPeakHc };
  }, [weekData, processOrder]);

  // ==================================================================================
  //  ALGORITMO "SMOOTH WEEK": ZERAGEM DOMINGO 14:00 (COM LIMITES POR TURNO)
  // ==================================================================================
  const handleSmartDistributeWeek = () => {
    if (!confirm("A IA irá distribuir o HC para zerar o backlog até DOMINGO às 14:00, respeitando os limites de cada TURNO. Continuar?")) return;

    const newWeekData = [...weekData];
    
    // 1. Calcular Demanda Global
    const demandsPerProc: Record<number, number> = {}; 
    const effectiveHoursPerProc: Record<number, number> = {}; 

    processOrder.forEach(p => {
        demandsPerProc[p.id] = 0;
        effectiveHoursPerProc[p.id] = 0;
    });

    newWeekData.forEach((day, dayIdx) => {
        let currentStageVolume = day.volume;

        processOrder.forEach((proc, idx) => {
            const settings = day.parentSettings[proc.id] || { split: 100 };
            const isTypeChange = idx > 0 && processOrder[idx-1].type === 'Inbound' && proc.type === 'Outbound';
            const typeMultiplier = isTypeChange ? (day.consolidation / 100) : 1;
            const splitMultiplier = settings.split / 100;

            const inputVolume = currentStageVolume * typeMultiplier * splitMultiplier;
            demandsPerProc[proc.id] += inputVolume;
            currentStageVolume = inputVolume; 

            const hoursArray = Array.from({ length: 24 }, (_, i) => (day.shiftStart + i) % 24);
            hoursArray.forEach((h, hIdx) => {
                if (dayIdx === 6 && h >= 14) return; // Domingo após 14h off
                const efficiency = (day.efficiencyMatrix[h] ?? 100) / 100;
                effectiveHoursPerProc[proc.id] += efficiency;
            });
        });
    });

    // 2. Calcular HC Ideal e Aplicar Limites
    processOrder.forEach(proc => {
        let idealHc = 0;
        if (proc.standardProductivity > 0 && effectiveHoursPerProc[proc.id] > 0) {
            idealHc = Math.ceil(demandsPerProc[proc.id] / (proc.standardProductivity * effectiveHoursPerProc[proc.id]));
        }

        newWeekData.forEach((day, dayIdx) => {
            const hoursArray = Array.from({ length: 24 }, (_, i) => (day.shiftStart + i) % 24);
            
            hoursArray.forEach((h, hIdx) => {
                // Domingo após 14h: HC = 0
                if (dayIdx === 6 && h >= 14) {
                    day.hcMatrix[`P-${proc.id}-${h}`] = 0;
                    return;
                }

                // Identifica Turno (1, 2 ou 3) com base no índice da hora
                const shift = getShiftForHour(hIdx);
                
                // Pega o limite específico daquele turno
                let limit = 0;
                if (shift === 1) limit = day.maxHcT1;
                else if (shift === 2) limit = day.maxHcT2;
                else limit = day.maxHcT3;

                // Aplica Limite se existir (>0)
                let finalHc = idealHc;
                if (limit > 0 && finalHc > limit) {
                    // Nota: Assim como antes, isso aplica o limite do turno para *este processo*
                    // Se for um limite global de planta, precisaria de rateio.
                    // Assumimos aqui simplificação de alocação direta.
                    finalHc = limit;
                }

                const efficiency = (day.efficiencyMatrix[h] ?? 100) / 100;
                finalHc = efficiency === 0 ? 0 : finalHc;
                
                if (proc.subprocesses) {
                    proc.subprocesses.forEach(s => day.hcMatrix[`S-${s.id}-${h}`] = 0);
                }
                day.hcMatrix[`P-${proc.id}-${h}`] = finalHc;
            });
        });
    });
    
    // 3. Rateio Global (Pós-Processamento) para garantir teto por turno
    newWeekData.forEach((day, dayIdx) => {
        const hoursArray = Array.from({ length: 24 }, (_, i) => (day.shiftStart + i) % 24);
        
        hoursArray.forEach((h, hIdx) => {
            if (dayIdx === 6 && h >= 14) return;

            // Identifica limite do turno atual
            const shift = getShiftForHour(hIdx);
            let limit = 0;
            if (shift === 1) limit = day.maxHcT1;
            else if (shift === 2) limit = day.maxHcT2;
            else limit = day.maxHcT3;

            if (limit <= 0) return; // Sem limite

            // Soma total alocado nesta hora
            let totalHourHc = 0;
            processOrder.forEach(proc => {
                totalHourHc += (day.hcMatrix[`P-${proc.id}-${h}`] || 0);
            });

            // Se estourou, corta proporcionalmente
            if (totalHourHc > limit) {
                const factor = limit / totalHourHc;
                processOrder.forEach(proc => {
                    const current = day.hcMatrix[`P-${proc.id}-${h}`] || 0;
                    day.hcMatrix[`P-${proc.id}-${h}`] = Math.floor(current * factor);
                });
            }
        });
    });

    setWeekData(newWeekData);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    DAYS_OF_WEEK.forEach((dayName, dayIdx) => {
      const hours = weekSimulation.daysHours[dayIdx];
      const results = weekSimulation.fullWeekResults[dayIdx];
      const headerRow = ["Processo", "Subprocesso", "Indicador", ...hours.map(h => `${h.toString().padStart(2, '0')}:00`)];
      const sheetData: (string | number)[][] = [headerRow];

      processOrder.forEach(proc => {
        const procData = results[proc.id] || [];
        const rowParent = [proc.name, "-", "HC (Pai)", ...procData.map((d, i) => weekData[dayIdx].hcMatrix[`P-${proc.id}-${d.hour}`] || 0)];
        sheetData.push(rowParent);
        if (proc.subprocesses) {
            proc.subprocesses.forEach(sub => {
                const rowSub = [proc.name, sub.name, "HC (Sub)", ...procData.map((d, i) => weekData[dayIdx].hcMatrix[`S-${sub.id}-${d.hour}`] || 0)];
                sheetData.push(rowSub);
            });
        }
        sheetData.push([proc.name, "TOTAL", "HC Total", ...procData.map(d => d.totalHc)]);
        sheetData.push([proc.name, "TOTAL", "Produção", ...procData.map(d => Math.round(d.output))]);
        sheetData.push([proc.name, "TOTAL", "Backlog", ...procData.map(d => Math.round(d.backlog))]);
        sheetData.push(["", "", "", ...hours.map(() => "")]);
      });
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, dayName);
    });
    XLSX.writeFile(wb, "Planejamento_Semanal_Inteligente.xlsx");
  };

  const activeResults = weekSimulation.fullWeekResults[activeDayIndex] || {};
  const activeHours = weekSimulation.daysHours[activeDayIndex] || [];
  const activePeakHc = weekSimulation.daysPeakHc[activeDayIndex] || 0; 
  
  let dayBacklogIn = 0;
  let dayBacklogOut = 0;
  Object.keys(activeResults).forEach(key => {
     const k = Number(key);
     const cells = activeResults[k];
     const lastVal = cells[cells.length - 1].backlog;
     const proc = processOrder.find(p => p.id === k);
     if(proc?.type === 'Inbound') dayBacklogIn += lastVal;
     else dayBacklogOut += lastVal;
  });

  if (loading) return <div className="p-10 text-center text-gray-500">Carregando...</div>;

  return (
    <div className="space-y-6 animate-fade-in-up pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Settings2 className="text-dhl-red" />
            Planejamento Semanal Inteligente
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Meta: Zerar Backlog até Domingo 14:00. Defina limites por turno nos cards.
          </p>
        </div>
        <div className="flex gap-2">
           <div className="flex gap-4 mr-4 items-center">
              <div className="flex flex-col items-end border-r border-gray-200 pr-4">
                 <div className="flex items-center gap-1 text-purple-600 font-bold text-sm">
                    <TrendingUp size={16}/> Pico Pessoas
                 </div>
                 <span className="text-2xl font-bold text-gray-800 leading-none">
                    {activePeakHc}
                 </span>
                 <span className="text-[10px] text-gray-400">hoje</span>
              </div>
              <div className="flex flex-col items-end">
                 <div className="text-[10px] uppercase font-bold text-gray-400">Backlog Inbound</div>
                 <span className={`text-sm font-bold ${dayBacklogIn > currentDayData.limitInbound ? 'text-dhl-red' : 'text-green-600'}`}>
                    {(dayBacklogIn/1000).toFixed(1)}k
                 </span>
              </div>
              <div className="flex flex-col items-end">
                 <div className="text-[10px] uppercase font-bold text-gray-400">Backlog Outbound</div>
                 <span className={`text-sm font-bold ${dayBacklogOut > currentDayData.limitOutbound ? 'text-dhl-red' : 'text-green-600'}`}>
                    {(dayBacklogOut/1000).toFixed(1)}k
                 </span>
              </div>
           </div>

           <button onClick={handleSmartDistributeWeek} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 hover:bg-purple-700 transition-all">
            <Wand2 size={18} /> IA Semanal
          </button>
          <button onClick={handleExportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 hover:bg-green-700 transition-all">
            <Save size={18} /> Excel
          </button>
        </div>
      </div>

      {/* --- CONFIGURAÇÃO SEMANAL (CARDS) --- */}
      <div className="grid grid-cols-7 gap-2 mb-2 overflow-x-auto pb-2">
        {DAYS_OF_WEEK.map((day, idx) => (
            <div 
                key={day} 
                onClick={() => setActiveDayIndex(idx)}
                className={`
                    cursor-pointer p-2 rounded-xl border-2 transition-all flex flex-col gap-1.5 min-w-[150px]
                    ${activeDayIndex === idx ? 'border-dhl-red bg-white shadow-md ring-1 ring-dhl-red' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}
                `}
            >
                <div className="flex items-center justify-between">
                    <span className={`font-bold text-xs ${activeDayIndex === idx ? 'text-dhl-red' : 'text-gray-500'}`}>{day}</span>
                    {activeDayIndex === idx && <div className="w-2 h-2 rounded-full bg-dhl-red"></div>}
                </div>
                
                {/* Volume & Consolidação */}
                <div className="grid grid-cols-2 gap-1">
                    <div className="bg-white rounded p-1 border border-gray-200">
                        <span className="text-[8px] font-bold text-gray-400 block uppercase">Vol</span>
                        <input 
                            type="number" className="w-full text-xs font-bold text-gray-800 outline-none"
                            value={weekData[idx].volume}
                            onChange={(e) => updateDayData(idx, 'volume', Number(e.target.value))}
                        />
                    </div>
                    <div className="bg-white rounded p-1 border border-gray-200">
                        <span className="text-[8px] font-bold text-gray-400 block uppercase">Cons%</span>
                        <input 
                            type="number" className="w-full text-xs font-bold text-blue-600 outline-none"
                            value={weekData[idx].consolidation}
                            onChange={(e) => updateDayData(idx, 'consolidation', Number(e.target.value))}
                        />
                    </div>
                </div>

                {/* Limites por Turno */}
                <div className="bg-purple-50 rounded p-1.5 border border-purple-100">
                    <span className="text-[8px] font-bold text-purple-400 block uppercase mb-1">Max HC / Turno</span>
                    <div className="flex gap-1">
                        <input 
                            type="number" placeholder="T1" title="Turno 1 (00-08)"
                            className="w-full text-[10px] font-bold text-center text-purple-700 bg-white rounded border border-purple-200"
                            value={weekData[idx].maxHcT1 || ''}
                            onChange={(e) => updateDayData(idx, 'maxHcT1', Number(e.target.value))}
                        />
                        <input 
                            type="number" placeholder="T2" title="Turno 2 (08-16)"
                            className="w-full text-[10px] font-bold text-center text-purple-700 bg-white rounded border border-purple-200"
                            value={weekData[idx].maxHcT2 || ''}
                            onChange={(e) => updateDayData(idx, 'maxHcT2', Number(e.target.value))}
                        />
                        <input 
                            type="number" placeholder="T3" title="Turno 3 (16-24)"
                            className="w-full text-[10px] font-bold text-center text-purple-700 bg-white rounded border border-purple-200"
                            value={weekData[idx].maxHcT3 || ''}
                            onChange={(e) => updateDayData(idx, 'maxHcT3', Number(e.target.value))}
                        />
                    </div>
                </div>
            </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-b-lg rounded-r-lg shadow-md border-t-4 border-dhl-yellow">
        
        {/* PARÂMETROS DO DIA ATUAL */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 items-end">
           <div className="md:col-span-1">
             <label className="text-[10px] font-bold text-gray-400 uppercase">Início Turno</label>
             <select className="w-full font-bold bg-transparent border-b border-gray-300" value={currentDayData.shiftStart} onChange={e => updateCurrentDay('shiftStart', Number(e.target.value))}>
                {Array.from({length: 24}, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>)}
             </select>
           </div>
        </div>

        {/* ORDENAÇÃO */}
        <div className="mb-8">
          <h3 className="font-bold text-gray-700 mb-3 text-xs uppercase flex items-center gap-2">
            <Settings2 size={14} /> Fluxo Operacional
          </h3>
          <div className="flex flex-wrap gap-3">
            {processOrder.map((proc, idx) => (
              <div 
                key={proc.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded border font-bold text-xs cursor-grab active:cursor-grabbing select-none transition-all
                  ${proc.type === 'Inbound' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800'}
                  ${draggedItemIndex === idx ? 'opacity-50 border-dashed border-gray-400' : ''}
                `}
              >
                <GripVertical size={14} className="text-gray-400" />
                <span className="bg-white/50 px-1.5 rounded text-[10px] text-gray-500">{idx + 1}</span>
                {proc.name}
                {idx < processOrder.length - 1 && <ArrowRight className="text-gray-300 ml-2" size={14} />}
              </div>
            ))}
          </div>
        </div>

        {/* EFICIÊNCIA */}
        <div className="mb-8 overflow-x-auto border border-orange-200 rounded-lg bg-orange-50/30">
            <div className="flex min-w-max">
                <div className="p-3 w-[200px] font-bold text-orange-600 flex items-center gap-2 sticky left-0 bg-orange-50 z-10 border-r border-orange-200 shadow-sm">
                    <Clock size={16} /> % Eficiência
                </div>
                {activeHours.map(h => (
                    <div key={h} className="p-2 min-w-[65px] border-r border-orange-100 text-center">
                        <div className="text-[10px] text-gray-400 mb-1">{h.toString().padStart(2, '0')}:00</div>
                        <input 
                            type="number" min="0" max="100"
                            className={`w-full text-center font-bold bg-white border rounded px-1 text-xs ${currentDayData.efficiencyMatrix[h] < 100 ? 'text-red-500 border-red-200 bg-red-50' : 'text-orange-600 border-orange-200'}`}
                            value={currentDayData.efficiencyMatrix[h] ?? 100}
                            onChange={e => handleEfficiencyChange(h, e.target.value)}
                        />
                    </div>
                ))}
            </div>
        </div>

        {/* GRID DE PROCESSOS */}
        <div className="space-y-8">
          {processOrder.map((proc) => {
            const data = activeResults[proc.id] || [];
            const settings = currentDayData.parentSettings[proc.id] || { split: 100 };

            return (
              <div key={proc.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white ring-1 ring-gray-100">
                <div className="px-4 py-2 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between gap-3">
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${proc.type === 'Inbound' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {proc.type === 'Inbound' ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 text-base">{proc.name}</h4>
                        <span className="text-[10px] text-gray-500">Meta Pai: <strong>{proc.standardProductivity}</strong></span>
                      </div>
                   </div>
                   <div className="flex gap-4">
                       <div className="flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-1">
                          <span className="text-[9px] font-bold text-gray-400">VOL %</span>
                          <input 
                            type="number" className="w-10 text-xs text-center border rounded"
                            value={settings.split} onChange={e => handleParentSettingChange(proc.id, 'split', Number(e.target.value))}
                          />
                       </div>
                   </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center border-collapse">
                        <thead>
                            <tr className="bg-gray-100/50 text-gray-400">
                               <th className="p-2 w-[220px] text-left pl-6 sticky left-0 bg-white z-10 border-b border-gray-200">Subprocesso / Indicador</th>
                               {activeHours.map(h => (
                                  <th key={h} className="min-w-[65px] border-r border-b border-gray-100 font-normal">
                                    {h.toString().padStart(2, '0')}:00
                                  </th>
                               ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="group hover:bg-gray-50 transition-colors">
                                <td className="p-2 text-left pl-6 sticky left-0 bg-white z-10 border-r border-gray-200 font-bold text-gray-700">
                                    {proc.name} (Pai)
                                </td>
                                {activeHours.map(h => (
                                    <td key={h} className="p-1 border-r border-gray-100">
                                        <input 
                                            type="number" 
                                            className="w-full text-center font-bold text-blue-600 bg-blue-50/10 rounded focus:bg-white hover:bg-white border border-transparent hover:border-blue-200 py-1"
                                            value={currentDayData.hcMatrix[`P-${proc.id}-${h}`] || 0}
                                            onChange={e => handleHcChange(`P-${proc.id}`, h, e.target.value)}
                                        />
                                    </td>
                                ))}
                            </tr>
                            {proc.subprocesses && proc.subprocesses.map(sub => (
                                <tr key={sub.id} className="group hover:bg-gray-50 transition-colors">
                                    <td className="p-2 text-left pl-10 sticky left-0 bg-white z-10 border-r border-gray-200 text-gray-600 flex items-center gap-2">
                                        <CornerDownRight size={12} className="text-gray-300"/> {sub.name}
                                    </td>
                                    {activeHours.map(h => (
                                        <td key={h} className="p-1 border-r border-gray-100">
                                            <input 
                                                type="number" 
                                                className="w-full text-center font-medium text-gray-600 bg-gray-50 rounded focus:bg-white hover:bg-white border border-transparent hover:border-gray-300 py-1"
                                                value={currentDayData.hcMatrix[`S-${sub.id}-${h}`] || 0}
                                                onChange={e => handleHcChange(`S-${sub.id}`, h, e.target.value)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            <tr className="bg-blue-50/20 border-t border-gray-200 font-bold text-blue-800">
                               <td className="p-2 text-left pl-6 sticky left-0 bg-blue-50/20 z-10 border-r border-gray-200 flex items-center gap-2">
                                  <Users size={14} /> Total Pessoas
                               </td>
                               {data.map((d, i) => (
                                  <td key={i} className="p-1 border-r border-gray-100 text-blue-700">
                                      {d.totalHc}
                                  </td>
                               ))}
                            </tr>
                            <tr className="bg-green-50/20 font-bold">
                               <td className="p-2 text-left pl-6 sticky left-0 bg-green-50/20 z-10 border-r border-gray-200 flex items-center gap-2 text-green-700">
                                  <CheckCircle2 size={14} /> Total Produção
                               </td>
                               {data.map((d, i) => (
                                  <td key={i} className="p-1 border-r border-gray-100 text-green-700">
                                      {Math.round(d.output)}
                                  </td>
                               ))}
                            </tr>
                            <tr className="font-bold">
                               <td className="p-2 text-left pl-6 sticky left-0 bg-white z-10 border-r border-gray-200 flex items-center gap-2 text-dhl-red">
                                  <AlertTriangle size={14}/> Total Backlog
                               </td>
                               {data.map((d, i) => (
                                  <td key={i} className={`p-1 border-r border-gray-100 ${d.backlog > 0 ? 'text-dhl-red bg-red-50/30' : 'text-gray-300'}`}>
                                      {d.backlog > 0 ? Math.round(d.backlog) : '-'}
                                  </td>
                               ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}