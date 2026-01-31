import { useState, useEffect, useMemo } from 'react';
import { api } from '../Services/api'; 
import { AIScheduler } from '../utils/AIScheduler'; 
import { 
  Save, Users, ArrowDownCircle, ArrowUpCircle, AlertTriangle, 
  Wand2, CheckCircle2, CornerDownRight, Clock, GripVertical, TrendingUp,
  Trash2, CloudDownload, CalendarRange, Warehouse, ArrowRight
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
  warehouse?: string;
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

interface MonthlyForecastItem {
  date: string;
  inboundM03: number;
  outboundM03: number;
}

interface ForecastResponse {
  data: MonthlyForecastItem[];
}

const DAYS_OF_WEEK = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const LOW_EFFICIENCY_HOURS = [0, 1, 11, 12, 18, 19];
const CACHE_KEY = 'labor_control_week_v15_m03'; // Atualizado v15

// --- MATRIZ DE CONSOLIDAÇÃO ---
const CONSOLIDATION_MATRIX: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 70, 70, 70, 70, 70, 70, 167, 115, 106, 94],
  [65, 76, 61, 56, 57, 58, 59, 69, 62, 63, 64, 64, 64, 65, 67, 68, 69, 70, 71, 72, 74, 77, 78, 115],
  [123, 119, 120, 116, 106, 99, 95, 92, 93, 93, 95, 95, 97, 98, 100, 102, 103, 105, 106, 107, 109, 112, 116, 120],
  [89, 93, 93, 94, 93, 94, 95, 96, 99, 102, 104, 108, 108, 109, 111, 113, 116, 118, 118, 120, 122, 123, 123, 121],
  [89, 92, 92, 94, 96, 97, 98, 101, 102, 102, 103, 103, 112, 104, 105, 107, 109, 111, 112, 113, 115, 116, 114, 112],
  [88, 91, 96, 96, 98, 95, 94, 98, 100, 101, 101, 102, 102, 103, 105, 108, 110, 111, 112, 113, 115, 115, 115, 181],
  [125, 126, 124, 127, 137, 138, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

export function SchedulerM03() {
  const [loading, setLoading] = useState(false);
  const [processOrder, setProcessOrder] = useState<Process[]>([]);
  const [activeDayIndex, setActiveDayIndex] = useState(0); 
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  
  // --- NOVOS ESTADOS DE DATA ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [importing, setImporting] = useState(false);

  const generateEfficiencyMatrix = (): Record<number, number> => {
    const matrix: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
        matrix[i] = LOW_EFFICIENCY_HOURS.includes(i) ? 50 : 100;
    }
    return matrix;
  };

  const [weekData, setWeekData] = useState<DayScenario[]>(
    Array.from({ length: 7 }, () => ({
        volume: 0, 
        consolidation: 100,
        shiftStart: 0, // <--- PADRÃO 00:00
        limitInbound: 50000,   
        limitOutbound: 130000, 
        maxHcT1: 0, maxHcT2: 0, maxHcT3: 0,
        hcMatrix: {},
        efficiencyMatrix: generateEfficiencyMatrix(),
        parentSettings: {}
    }))
  );

  useEffect(() => { loadProcesses(); }, []);

  // Inicializa datas com a semana atual (Seg-Dom)
  useEffect(() => {
    if (!startDate) {
        const today = new Date();
        handleDateSelection(today.toISOString().split('T')[0]);
    }
  }, []);

  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) setWeekData(JSON.parse(cachedData));
  }, []);

  useEffect(() => {
    if (weekData.length > 0) localStorage.setItem(CACHE_KEY, JSON.stringify(weekData));
  }, [weekData]);

  // --- LÓGICA DE DATA: FORÇAR SEMANA (SEG-DOM) ---
  const handleDateSelection = (dateVal: string) => {
    if(!dateVal) return;
    const date = new Date(dateVal + 'T12:00:00'); 
    const day = date.getDay(); // 0 (Dom) a 6 (Sab)
    
    // Calcula a segunda-feira da semana
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    
    const monday = new Date(date);
    monday.setDate(diff);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    setStartDate(monday.toISOString().split('T')[0]);
    setEndDate(sunday.toISOString().split('T')[0]);
  };

  async function loadProcesses() {
    setLoading(true);
    try {
      const response = await api.get('/processes');
      const allProcesses: Process[] = response.data;
      const m03Processes = allProcesses.filter(p => !p.warehouse || p.warehouse === 'M03' || p.warehouse === 'All');
      setProcessOrder(m03Processes);

      // Default Splits
      const defaultSettings: Record<number, { split: number }> = {};
      m03Processes.forEach(p => {
        const nameLower = p.name.toLowerCase();
        if (nameLower.includes('sorting') || nameLower.includes('classificação')) {
            defaultSettings[p.id] = { split: 50 };
        } else {
            defaultSettings[p.id] = { split: 100 };
        }
      });

      setWeekData(prev => prev.map(day => {
        const mergedSettings = { ...defaultSettings };
        const finalSettings = { ...mergedSettings, ...day.parentSettings };
        m03Processes.forEach(p => {
            if (!day.parentSettings[p.id]) finalSettings[p.id] = defaultSettings[p.id];
        });
        return { ...day, parentSettings: finalSettings };
      }));

    } catch (error) {
      console.error("Erro ao carregar processos", error);
    } finally {
      setLoading(false);
    }
  }

  const handleImportWeeklyForecast = async () => {
    if (!startDate || !endDate) return alert("Selecione a semana de referência.");
    setImporting(true);
    
    try {
        const datesInRange: string[] = [];
        let currentDate = new Date(startDate + 'T12:00:00'); 
        const end = new Date(endDate + 'T12:00:00');

        while (currentDate.getTime() <= end.getTime()) {
            datesInRange.push(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const monthsToFetch = new Set<string>();
        datesInRange.forEach(d => {
            const [y, m] = d.split('-');
            monthsToFetch.add(`${y}-${m}`);
        });

        let allData: MonthlyForecastItem[] = [];
        
        for (const ym of monthsToFetch) {
            const [year, month] = ym.split('-').map(Number);
            try {
                const response = await api.get<ForecastResponse>('/forecast/monthly', { params: { year, month } });
                if(response.data?.data) allData = [...allData, ...response.data.data];
            } catch (e) { console.warn(`Sem dados para ${ym}`); }
        }

        setWeekData(prev => {
            const newData = [...prev];
            datesInRange.forEach((dateStr, idx) => {
                if (idx < 7) { 
                    const dayForecast = allData.find(d => d.date.startsWith(dateStr));
                    if (dayForecast) {
                        newData[idx].volume = dayForecast.inboundM03 * 1000;
                    } else {
                        newData[idx].volume = 0; 
                    }
                }
            });
            return newData;
        });
        alert(`Forecast importado para a semana de ${startDate}!`);
    } catch (error) {
        console.error(error);
        alert("Erro ao importar forecast.");
    } finally {
        setImporting(false);
    }
  };

  const handleResetData = () => {
    if(!confirm(`Resetar todo o planejamento M03?`)) return;
    localStorage.removeItem(CACHE_KEY);
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
    const outputsByProcess: Record<number, number[][]> = {};
    
    let pickingId: number | null = null;
    const sortingIds: number[] = [];
    processOrder.forEach(p => {
        const name = p.name.toLowerCase();
        outputsByProcess[p.id] = weekData.map(() => Array(24).fill(0)); 
        if (name.includes('picking') || name.includes('separação')) pickingId = p.id;
        if (name.includes('sort') || name.includes('classificação')) sortingIds.push(p.id);
    });

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
          const isPicking = proc.id === pickingId;
          const isPacking = procName.includes('packing') || procName.includes('embalagem');

          let currentBacklog = runningBacklogs[proc.id];
          const settings = dayData.parentSettings[Number(proc.id)] || { split: 100 };
          const splitRatio = settings.split / 100;

          // --- LOGICA DE DISTRIBUIÇÃO DE VOLUME ---
          // Calcula quantas horas tem no dia a partir do inicio do turno
          const remainingHours = 24 - dayData.shiftStart;

          hoursArray.forEach((hour, hIdx) => {
             let input = 0;

             if (isReceiving) {
                 // REGRA DE NEGÓCIO: Se turno começa 14h, divide o volume por 10h (14h-24h)
                 // E aplica apenas se estiver dentro desse range no dia corrente.
                 // hIdx vai de 0 a 23. Se hIdx < remainingHours, estamos no dia atual.
                 if (hIdx < remainingHours) {
                    input = dayData.volume / remainingHours;
                 } else {
                    input = 0; // Zera o input nas horas que viraram o dia (madrugada)
                 }
             } 
             else if (isPicking) {
                 const prevProc = processOrder[idx - 1];
                 const previousOutput = prevProc ? outputsByProcess[prevProc.id][dayIdx][hour] : 0;
                 const consolidationRate = CONSOLIDATION_MATRIX[dayIdx][hour];
                 const consolidationFactor = consolidationRate / 100;
                 input = previousOutput * consolidationFactor;
             }
             else if (isSorting && pickingId) {
                 input = outputsByProcess[pickingId][dayIdx][hour] * splitRatio;
             } 
             else if (isPacking) {
                 let totalSort = 0;
                 sortingIds.forEach(sid => totalSort += outputsByProcess[sid][dayIdx][hour]);
                 input = totalSort;
             } 
             else {
                 const prevProc = processOrder[idx - 1];
                 if (prevProc) input = outputsByProcess[prevProc.id][dayIdx][hour] * splitRatio;
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

             procCells.push({ 
                hour, input, efficiency: efficiency * 100, totalHc: directHc + indirectHc, 
                directHc, indirectHc, capacity, output, backlog: newBacklog 
             });
          });
          
          runningBacklogs[proc.id] = currentBacklog;
          dayResults[proc.id] = procCells;
       });
       fullWeekResults[dayIdx] = dayResults;
       daysPeakHc[dayIdx] = Math.max(...hourlyTotalHc);
    });
    return { fullWeekResults, daysHours, daysPeakHc };
  }, [weekData, processOrder]);

  const handleSmartDistributeWeek = () => {
    if (!confirm(`A IA irá calcular o plano para M03. Continuar?`)) return;
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

  const activeResults = weekSimulation.fullWeekResults[activeDayIndex] || {};
  const activeHours = weekSimulation.daysHours[activeDayIndex] || [];
  const activePeakHc = weekSimulation.daysPeakHc[activeDayIndex] || 0; 
  let dayBacklogIn = 0; let dayBacklogOut = 0;
  Object.keys(activeResults).forEach(key => {
     const k = Number(key); const cells = activeResults[k]; const lastVal = cells[cells.length - 1].backlog;
     const proc = processOrder.find(p => p.id === k);
     if(proc?.type === 'Inbound') dayBacklogIn += lastVal; else dayBacklogOut += lastVal;
  });

  if (loading) return <div className="flex h-screen items-center justify-center text-dhl-red font-bold animate-pulse">Carregando M03...</div>;

  return (
    <>
    <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
    `}</style>

    <div className="space-y-8 animate-fade-in-up pb-32">
      
      {/* HEADER */}
      <div className="bg-white rounded-3xl p-1 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-dhl-yellow/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="bg-white rounded-2xl p-6 relative z-10 flex flex-col xl:flex-row items-center justify-between gap-6">
            <div>
                <h1 className="text-4xl font-black text-gray-800 tracking-tight flex items-center gap-3">
                    WFM <span className="text-dhl-red">Planner</span>
                </h1>
                <div className="flex items-center gap-2 mt-3 bg-red-50 p-2 rounded-xl w-fit border border-dhl-red/20">
                    <Warehouse size={16} className="text-dhl-red" />
                    <span className="text-dhl-red font-bold">Visão M03 (Warehouse)</span>
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 bg-gray-50 p-3 rounded-2xl border border-gray-200">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Semana De (Segunda)</span>
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200">
                            <CalendarRange size={16} className="text-gray-400" />
                            <input 
                                type="date" 
                                className="bg-transparent font-bold text-gray-700 text-sm outline-none cursor-pointer" 
                                value={startDate} 
                                onChange={e => handleDateSelection(e.target.value)} 
                            />
                        </div>
                    </div>
                    <div className="flex items-center pt-4 text-gray-300">
                        <ArrowRight size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Até (Domingo)</span>
                        <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-xl border border-gray-200">
                            <input 
                                type="date" 
                                className="bg-transparent font-bold text-gray-500 text-sm outline-none cursor-not-allowed" 
                                value={endDate} 
                                disabled 
                            />
                        </div>
                    </div>
                </div>
                <button onClick={handleImportWeeklyForecast} disabled={importing} className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center gap-2 transition-all text-xs disabled:opacity-50">
                    {importing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <CloudDownload size={18} />} 
                    Importar Forecast
                </button>
            </div>

            <div className="flex items-center gap-3">
               <button onClick={handleResetData} className="h-12 w-12 flex items-center justify-center bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 rounded-xl transition-all" title="Resetar"><Trash2 size={20} /></button>
               <button onClick={handleSmartDistributeWeek} className="h-12 px-6 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-lg shadow-purple-200 flex items-center gap-2 transition-all"><Wand2 size={20} /> AI Scale</button>
               <button className="h-12 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 flex items-center gap-2 transition-all"><Save size={20} /></button>
            </div>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div><p className="text-xs font-bold text-gray-400 uppercase">Backlog Entrada</p><p className={`text-2xl font-black ${dayBacklogIn > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{(dayBacklogIn/1000).toFixed(1)}k</p></div>
              <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><ArrowDownCircle /></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div><p className="text-xs font-bold text-gray-400 uppercase">Backlog Saída</p><p className={`text-2xl font-black ${dayBacklogOut > 130000 ? 'text-red-600' : 'text-emerald-500'}`}>{(dayBacklogOut/1000).toFixed(1)}k</p></div>
              <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><ArrowUpCircle /></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div><p className="text-xs font-bold text-gray-400 uppercase">Pico de Pessoas</p><p className="text-2xl font-black text-gray-800">{activePeakHc}</p></div>
              <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><Users /></div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div><p className="text-xs font-bold text-gray-400 uppercase">Eficiência</p><p className="text-2xl font-black text-blue-600">98%</p></div>
              <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><TrendingUp /></div>
          </div>
      </div>

      {/* DAYS SELECTOR */}
      <div className="w-full">
        <div className="flex gap-4 overflow-x-auto pb-6 pt-2 px-2 snap-x hide-scrollbar w-full">
            {DAYS_OF_WEEK.map((day, idx) => {
                const isSelected = activeDayIndex === idx;
                return (
                    <div key={day} onClick={() => setActiveDayIndex(idx)} className={`flex-shrink-0 snap-start w-[180px] cursor-pointer p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${isSelected ? 'bg-white border-dhl-red ring-4 ring-dhl-red/10 shadow-xl scale-105 z-10' : 'bg-white border-gray-200 hover:border-dhl-yellow/50 hover:shadow-md'}`}>
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

      {/* SHIFT & GRID */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
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