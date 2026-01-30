import { useState, useEffect, useMemo } from 'react';
import { api } from '../Services/api'; 
import * as XLSX from 'xlsx'; 
import { AIScheduler } from '../utils/AIScheduler'; 
import { 
  Save, Settings2, Users,
  ArrowDownCircle, ArrowUpCircle, AlertTriangle, 
  Wand2, CheckCircle2,
  CornerDownRight, Clock, GripVertical, TrendingUp,
  ArrowRight, Trash2, Calendar, Cpu, Sparkles
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

interface SimulationCell {
  hour: number;
  input: number;      
  efficiency: number; 
  directHc: number;   
  indirectHc: number; 
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
  maxHcT1: number; 
  maxHcT2: number;
  maxHcT3: number;
  hcMatrix: Record<string, number>; 
  efficiencyMatrix: Record<number, number>;
  parentSettings: Record<number, { split: number }>; 
}

const DAYS_OF_WEEK = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DEFAULT_ORDER = ["Recebimento", "PutWay", "Picking", "Sorting Aut", "Sorting Manual", "Packing", "Handover Last Mile"];
const LOW_EFFICIENCY_HOURS = [0, 1, 11, 12, 18, 19];
// ATUALIZADO: Cache Key V10 para forçar reset da lógica antiga
const LOCAL_STORAGE_KEY = 'labor_control_week_cache_v10_strategic_view'; 

export function Scheduler() {
  const [loading, setLoading] = useState(false);
  const [processOrder, setProcessOrder] = useState<Process[]>([]);
  const [activeDayIndex, setActiveDayIndex] = useState(0); 
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const [weekData, setWeekData] = useState<DayScenario[]>(
    Array.from({ length: 7 }, () => {
      const eff: Record<number, number> = {};
      for(let h=0; h<24; h++) {
        eff[h] = LOW_EFFICIENCY_HOURS.includes(h) ? 50 : 100;
      }
      return {
        volume: 10000, 
        consolidation: 100,
        shiftStart: 0,
        limitInbound: 50000,   
        limitOutbound: 130000, 
        maxHcT1: 0,
        maxHcT2: 0,
        maxHcT3: 0,
        hcMatrix: {},
        efficiencyMatrix: eff,
        parentSettings: {}
      };
    })
  );

  useEffect(() => { loadProcesses(); }, []);

  useEffect(() => {
    if (weekData.length > 0 && processOrder.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(weekData));
    }
  }, [weekData, processOrder]);

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
      
      const cachedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cachedData) {
        setWeekData(JSON.parse(cachedData));
      } else {
        setWeekData(prev => prev.map(day => {
            const initialSettings: Record<number, { split: number }> = {};
            processes.forEach((p: Process) => {
               const name = p.name.toLowerCase().trim();
               const isSorting = name.includes('sort') || name.includes('clas') || name.includes('sep');
               initialSettings[Number(p.id)] = { split: isSorting ? 50 : 100 };
            });
            return { ...day, parentSettings: initialSettings };
        }));
      }
    } catch (error) {
      console.error("Erro ao carregar processos", error);
    } finally {
      setLoading(false);
    }
  }

  const handleResetData = () => {
    if(!confirm("Resetar planejamento?")) return;
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    window.location.reload(); 
  };

  const updateDayData = (dayIdx: number, field: keyof DayScenario, value: any) => {
    setWeekData(prev => {
      const newData = [...prev];
      newData[dayIdx] = { ...newData[dayIdx], [field]: value };
      return newData;
    });
  };

  const currentDayData = weekData[activeDayIndex];
  const updateCurrentDay = (field: keyof DayScenario, value: any) => updateDayData(activeDayIndex, field, value);

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
    const key = Number(procId);
    if (!newSettings[key]) newSettings[key] = { split: 100 };
    newSettings[key] = { ...newSettings[key], [field]: val };
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

  const weekSimulation = useMemo(() => {
    const fullWeekResults: Record<number, Record<number, SimulationCell[]>> = {};
    const daysHours: Record<number, number[]> = {};
    const daysPeakHc: Record<number, number> = {}; 
    
    // Armazena output real para o fluxo: Map<ProcessID, Matriz[Dia][Hora]>
    const outputsByProcess: Record<number, number[][]> = {};
    
    // Identifica IDs
    let pickingId: number | null = null;
    const sortingIds: number[] = [];
    processOrder.forEach(p => {
        const name = p.name.toLowerCase();
        outputsByProcess[p.id] = weekData.map(() => Array(24).fill(0)); 
        if (name.includes('picking') || name.includes('separação')) pickingId = p.id;
        if (name.includes('sort') || name.includes('classificação')) sortingIds.push(p.id);
    });

    // MAPA DE BACKLOGS PERSISTENTES (Visualização correta da herança entre dias)
    let runningBacklogs: Record<number, number> = {};
    processOrder.forEach(p => runningBacklogs[p.id] = 0);

    weekData.forEach((dayData, dayIdx) => {
       const dayResults: Record<number, SimulationCell[]> = {};
       const hoursArray = Array.from({ length: 24 }, (_, i) => (dayData.shiftStart + i) % 24);
       daysHours[dayIdx] = hoursArray;
       const hourlyTotalHc = new Array(24).fill(0); 
       
       processOrder.forEach((proc, idx) => {
          const procCells: SimulationCell[] = [];
          const procName = proc.name.toLowerCase();
          const isReceiving = idx === 0; 
          const isSorting = sortingIds.includes(proc.id);
          const isPacking = procName.includes('packing') || procName.includes('embalagem');

          // Recupera o backlog acumulado até o final do dia anterior
          let currentBacklog = runningBacklogs[proc.id];

          const settings = dayData.parentSettings[Number(proc.id)] || { split: 100 };
          const splitRatio = settings.split / 100;

          hoursArray.forEach((hour, hIdx) => {
             // Branch & Merge Logic (Visualização)
             let input = 0;
             if (isReceiving) {
                 input = dayData.volume / 24;
             } else if (isSorting && pickingId) {
                 input = outputsByProcess[pickingId][dayIdx][hour] * splitRatio;
             } else if (isPacking) {
                 let totalSort = 0;
                 sortingIds.forEach(sid => totalSort += outputsByProcess[sid][dayIdx][hour]);
                 input = totalSort;
             } else {
                 const prevId = processOrder[idx - 1].id;
                 input = outputsByProcess[prevId][dayIdx][hour] * splitRatio;
             }

             let directHc = dayData.hcMatrix[`P-${proc.id}-${hour}`] || 0;
             let indirectHc = 0;
             if (proc.subprocesses) {
                proc.subprocesses.forEach(sub => {
                    indirectHc += (dayData.hcMatrix[`S-${sub.id}-${hour}`] || 0);
                });
             }
             hourlyTotalHc[hIdx] += (directHc + indirectHc);
             
             const efficiency = (dayData.efficiencyMatrix[hour] ?? 100) / 100;
             const capacity = directHc * proc.standardProductivity * efficiency;
             
             const totalAvailable = input + currentBacklog;
             const output = Math.min(totalAvailable, capacity);
             const newBacklog = totalAvailable - output;
             
             outputsByProcess[proc.id][dayIdx][hour] = output;
             currentBacklog = newBacklog;

             procCells.push({ hour, input, efficiency: efficiency * 100, totalHc: directHc + indirectHc, directHc, indirectHc, capacity, output, backlog: newBacklog });
          });
          
          // Atualiza o backlog global do processo para o início do próximo dia
          runningBacklogs[proc.id] = currentBacklog;
          
          dayResults[proc.id] = procCells;
       });
       fullWeekResults[dayIdx] = dayResults;
       daysPeakHc[dayIdx] = Math.max(...hourlyTotalHc);
    });
    return { fullWeekResults, daysHours, daysPeakHc };
  }, [weekData, processOrder]);

  const handleSmartDistributeWeek = () => {
    if (!confirm("A IA irá calcular o plano Estratégico Semanal (Média Ponderada + Tetos de Backlog). Continuar?")) return;
    const aiProcessInput = processOrder.map(p => ({
      id: Number(p.id), name: p.name, type: p.type, standardProductivity: p.standardProductivity,
      subprocesses: p.subprocesses ? p.subprocesses.map(s => ({ id: s.id, standardProductivity: s.standardProductivity })) : []
    }));
    const newHcMap = AIScheduler.calculateSchedule(weekData, aiProcessInput);
    const newWeekData = weekData.map((day, dIdx) => {
        const updatedHcMatrix = { ...day.hcMatrix };
        Object.keys(newHcMap).forEach(key => {
            const parts = key.split('-'); 
            const dayIndexRef = parseInt(parts[3]);
            if (dayIndexRef === dIdx) {
                const localKey = `${parts[0]}-${parts[1]}-${parts[2]}`;
                updatedHcMatrix[localKey] = newHcMap[key];
            }
        });
        return { ...day, hcMatrix: updatedHcMatrix };
    });
    setWeekData(newWeekData);
  };

  const handleExportExcel = () => { alert("Exportando dados..."); };

  const activeResults = weekSimulation.fullWeekResults[activeDayIndex] || {};
  const activeHours = weekSimulation.daysHours[activeDayIndex] || [];
  const activePeakHc = weekSimulation.daysPeakHc[activeDayIndex] || 0; 
  let dayBacklogIn = 0; let dayBacklogOut = 0;
  
  Object.keys(activeResults).forEach(key => {
     const k = Number(key); const cells = activeResults[k]; const lastVal = cells[cells.length - 1].backlog;
     const proc = processOrder.find(p => p.id === k);
     if(proc?.type === 'Inbound') dayBacklogIn += lastVal; else dayBacklogOut += lastVal;
  });

  if (loading) return <div className="flex h-screen items-center justify-center text-dhl-red font-bold animate-pulse">Carregando...</div>;

  return (
    <>
    <style>{`
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>

    <div className="space-y-8 animate-fade-in-up pb-32">
      
      {/* HEADER FUTURISTA */}
      <div className="bg-white rounded-3xl p-1 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-dhl-yellow/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        
        <div className="bg-white rounded-2xl p-6 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
                <h1 className="text-4xl font-black text-gray-800 tracking-tight flex items-center gap-3">
                    WFM <span className="text-dhl-red">Planner</span>
                </h1>
                <p className="text-gray-500 font-medium mt-1">
                    Simulador Inteligente. Estratégia Semanal & Balanceamento de Fluxo.
                </p>
            </div>

            <div className="flex items-center gap-4 bg-gray-900 text-white p-2 pr-6 rounded-2xl shadow-2xl shadow-purple-500/20 border border-gray-800">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg animate-pulse">
                    <Cpu size={24} className="text-white" />
                </div>
                <div>
                    <div className="text-[10px] font-bold text-purple-300 uppercase tracking-widest flex items-center gap-1">
                        <Sparkles size={10} /> Strategic AI V10
                    </div>
                    <div className="text-sm font-bold text-gray-200">
                        Otimização Semanal Ativa
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
               <button onClick={handleResetData} className="h-12 w-12 flex items-center justify-center bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 rounded-xl transition-all" title="Resetar">
                <Trash2 size={20} />
               </button>
               <button onClick={handleSmartDistributeWeek} className="h-12 px-6 bg-dhl-red hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-200 flex items-center gap-2 transition-all transform hover:-translate-y-0.5">
                <Wand2 size={20} /> Calcular
               </button>
               <button onClick={handleExportExcel} className="h-12 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 flex items-center gap-2 transition-all">
                <Save size={20} />
               </button>
            </div>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Backlog Entrada</p>
                  <p className={`text-2xl font-black ${dayBacklogIn > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{(dayBacklogIn/1000).toFixed(1)}k</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><ArrowDownCircle /></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Backlog Saída</p>
                  <p className={`text-2xl font-black ${dayBacklogOut > 130000 ? 'text-red-600' : 'text-emerald-500'}`}>{(dayBacklogOut/1000).toFixed(1)}k</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><ArrowUpCircle /></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Pico de Pessoas</p>
                  <p className="text-2xl font-black text-gray-800">{activePeakHc}</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><Users /></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Eficiência Média</p>
                  <p className="text-2xl font-black text-blue-600">98%</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><TrendingUp /></div>
          </div>
      </div>

      {/* DAYS SELECTOR */}
      <div className="w-full">
        <div className="flex gap-4 overflow-x-auto pb-6 pt-2 px-2 snap-x hide-scrollbar w-full">
            {DAYS_OF_WEEK.map((day, idx) => {
                const isSelected = activeDayIndex === idx;
                return (
                    <div 
                        key={day} 
                        onClick={() => setActiveDayIndex(idx)} 
                        className={`
                            flex-shrink-0 snap-start w-[180px] cursor-pointer p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group 
                            ${isSelected ? 'bg-white border-dhl-red ring-4 ring-dhl-red/10 shadow-xl scale-105 z-10' : 'bg-white border-gray-200 hover:border-dhl-yellow/50 hover:shadow-md'}
                        `}
                    >
                        {isSelected && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-dhl-red to-dhl-yellow"></div>}
                        <div className="flex justify-between items-center mb-3">
                            <span className={`font-bold text-sm ${isSelected ? 'text-gray-800' : 'text-gray-400'}`}>{day}</span>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-dhl-red animate-pulse"></div>}
                        </div>
                        <div className="space-y-2">
                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-gray-50' : 'bg-gray-50/50'}`}>
                                <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Volume</label>
                                <input type="number" className="w-full bg-transparent font-bold text-gray-800 outline-none border-b border-dashed border-gray-300 focus:border-dhl-red text-sm" value={weekData[idx].volume} onChange={(e) => updateDayData(idx, 'volume', Number(e.target.value))} />
                            </div>
                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-50' : 'bg-gray-50/50'}`}>
                                <label className="text-[9px] font-bold text-blue-400 uppercase block mb-1">Consolidação %</label>
                                <input type="number" className="w-full bg-transparent font-bold text-blue-600 outline-none border-b border-dashed border-blue-200 focus:border-blue-500 text-sm" value={weekData[idx].consolidation} onChange={(e) => updateDayData(idx, 'consolidation', Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-1">
                            {['T1', 'T2', 'T3'].map((t, i) => (
                                <div key={t} className="text-center">
                                    <span className="text-[8px] text-gray-400 font-bold block mb-0.5">{t}</span>
                                    <input type="number" className={`w-full text-center text-[10px] font-bold rounded py-1 ${isSelected ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-400'}`} placeholder="-" value={i===0 ? weekData[idx].maxHcT1 : i===1 ? weekData[idx].maxHcT2 : weekData[idx].maxHcT3} onChange={(e) => updateDayData(idx, i===0?'maxHcT1':i===1?'maxHcT2':'maxHcT3', Number(e.target.value))} />
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
        {/* SHIFT & EFFICIENCY CONFIG */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><Clock size={14} /> Início do Turno</label>
                <div className="relative">
                    <select className="w-full appearance-none bg-white border border-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-dhl-red/20 focus:border-dhl-red transition-all cursor-pointer" value={currentDayData.shiftStart} onChange={e => updateCurrentDay('shiftStart', Number(e.target.value))}>
                        {Array.from({length: 24}, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500"><ArrowDownCircle size={16} /></div>
                </div>
            </div>
            <div className="lg:col-span-10 overflow-x-auto">
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Matriz de Eficiência (%)</label>
                <div className="flex gap-1">
                    {activeHours.map(h => (
                        <div key={h} className="flex-1 min-w-[45px]">
                            <div className="text-[10px] text-center text-gray-400 font-medium mb-1">{h.toString().padStart(2, '0')}h</div>
                            <input type="text" className={`w-full text-center text-xs font-bold py-2 rounded-lg border focus:ring-2 focus:ring-offset-1 outline-none transition-all ${currentDayData.efficiencyMatrix[h] < 100 ? 'bg-red-50 text-red-600 border-red-100 focus:ring-red-200' : 'bg-white text-gray-600 border-gray-200 focus:ring-dhl-yellow/50 focus:border-dhl-yellow'}`} value={currentDayData.efficiencyMatrix[h] ?? 100} onChange={e => handleEfficiencyChange(h, e.target.value)} />
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="divide-y divide-gray-100">
            {processOrder.map((proc) => {
                const data = activeResults[proc.id] || [];
                const settings = currentDayData.parentSettings[Number(proc.id)] || { split: 100 };
                return (
                    <div key={proc.id} className="group hover:bg-gray-50/30 transition-colors">
                        {/* Process Header */}
                        <div className="px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${proc.type === 'Inbound' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {proc.type === 'Inbound' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{proc.name}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">UPH: {proc.standardProductivity}</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Vol Split:</span>
                                            <input type="number" className="w-12 bg-white border border-gray-200 text-center text-xs font-bold rounded py-0.5 focus:border-dhl-red focus:ring-1 focus:ring-dhl-red outline-none" value={settings.split} onChange={e => handleParentSettingChange(proc.id, 'split', Number(e.target.value))} />
                                            <span className="text-xs text-gray-400">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div draggable onDragStart={() => handleDragStart(processOrder.indexOf(proc))} onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop(processOrder.indexOf(proc))} className="cursor-grab text-gray-300 hover:text-gray-500 p-2"><GripVertical size={20} /></div>
                        </div>

                        {/* Data Grid */}
                        <div className="overflow-x-auto pb-4 px-6">
                            <div className="inline-block min-w-full align-middle">
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="sticky left-0 z-20 bg-gray-50 py-3 pl-4 pr-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500 w-[200px] border-r border-gray-200 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">Detalhe / Hora</th>
                                                {activeHours.map(h => (<th key={h} className="px-2 py-3 text-center text-[10px] font-bold text-gray-400 border-r border-gray-100 min-w-[60px]">{h.toString().padStart(2, '0')}:00</th>))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            <tr className="bg-white">
                                                <td className="sticky left-0 z-20 bg-white py-3 pl-4 pr-3 text-sm font-bold text-gray-800 border-r border-gray-200 border-l-4 border-l-dhl-red"><div className="flex items-center gap-2"><Users size={14} className="text-dhl-red"/> Diretos</div></td>
                                                {activeHours.map(h => (<td key={h} className="p-1 border-r border-gray-100"><input type="text" className="w-full text-center font-bold text-gray-800 bg-gray-50 rounded-md py-1.5 focus:bg-white focus:ring-2 focus:ring-dhl-red/20 outline-none transition-all text-xs" value={currentDayData.hcMatrix[`P-${proc.id}-${h}`] || 0} onChange={e => handleHcChange(`P-${proc.id}`, h, e.target.value)} /></td>))}
                                            </tr>
                                            {proc.subprocesses && proc.subprocesses.map(sub => (
                                                <tr key={sub.id} className="bg-gray-50/30">
                                                    <td className="sticky left-0 z-20 bg-gray-50/50 py-2 pl-8 pr-3 text-xs font-medium text-gray-500 border-r border-gray-200 flex items-center gap-2"><CornerDownRight size={12} className="text-gray-300"/> {sub.name}</td>
                                                    {activeHours.map(h => (<td key={h} className="p-1 border-r border-gray-100"><input type="text" className="w-full text-center text-gray-500 bg-transparent rounded-md py-1 focus:bg-white focus:ring-1 focus:ring-gray-300 outline-none transition-all text-xs" value={currentDayData.hcMatrix[`S-${sub.id}-${h}`] || 0} onChange={e => handleHcChange(`S-${sub.id}`, h, e.target.value)} /></td>))}
                                                </tr>
                                            ))}
                                            <tr className="bg-gray-100/50">
                                                <td className="sticky left-0 z-20 bg-gray-100 py-2 pl-4 pr-3 text-xs font-bold text-gray-600 border-r border-gray-200"><div className="flex flex-col gap-1"><span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={10}/> Produção</span><span className="flex items-center gap-1 text-dhl-red"><AlertTriangle size={10}/> Backlog</span></div></td>
                                                {data.map((d, i) => (<td key={i} className="p-1 border-r border-gray-200 text-center align-middle"><div className="flex flex-col gap-1"><span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded px-1">{Math.round(d.output)}</span><span className={`text-[10px] font-bold px-1 rounded ${d.backlog > 0 ? 'text-dhl-red bg-red-50' : 'text-gray-300'}`}>{d.backlog > 0 ? Math.round(d.backlog) : '-'}</span></div></td>))}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
    </>
  );
}