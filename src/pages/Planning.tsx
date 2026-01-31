import { useState, useEffect, useMemo } from 'react';
import { api } from '../Services/api';
import { 
  Users, Clock, ArrowDownCircle, ArrowUpCircle, 
  RefreshCw, FileSpreadsheet, Box, ShieldAlert, Percent,
  CornerDownRight, Download, PieChart, Zap, TrendingUp, 
  CloudDownload, CalendarRange, Warehouse, Activity
} from 'lucide-react';

// --- INTERFACES (SEM FADIGA) ---
interface Subprocess {
  id: number;
  name: string;
  standardProductivity: number;
  efficiency?: number; // 0.0 a 1.0 (ex: 0.85)
  travelTime?: number; // Minutos por hora
  processId: number;
}

interface Process {
  id: number;
  name: string;
  type: 'Inbound' | 'Outbound';
  warehouse?: string;
  standardProductivity: number;
  efficiency?: number; // 0.0 a 1.0 (ex: 0.85)
  travelTime?: number; // Minutos por hora
  subprocesses: Subprocess[];
}

interface PlanRow {
  uniqueKey: string;
  type: 'Process' | 'Subprocess';
  parentId?: number;
  id: number;
  name: string;
  operationType: 'Inbound' | 'Outbound';
  warehouse?: string;
  metaBase: number; 
  metaReal: number; // Meta com eficiência
  travelTime: number; 
  splitPercentage: number;
  volumeCalculated: number;
  hours: number;
  hcBase: number;
  hcFinal: number;
}

interface MonthlyForecastItem {
  date: string;
  rcRecebimento: number; 
  inboundM03: number;
  outboundM03: number;
}

interface ForecastResponse {
  data: MonthlyForecastItem[];
}

export function Planning() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // --- CONFIGURAÇÕES DE DATA ---
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // --- FILTROS ---
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('All');

  // --- CONFIGURAÇÕES GERAIS ---
  const [workingHours, setWorkingHours] = useState(7.33); 
  const [absFactor, setAbsFactor] = useState(0); 

  // --- VOLUMES TOTAIS ---
  const [volInbound, setVolInbound] = useState<number>(0);
  const [volOutbound, setVolOutbound] = useState<number>(0);

  // --- CONTROLES ---
  const [shiftDist, setShiftDist] = useState({ s1: 40, s2: 40, s3: 20 }); 
  const [viewMode, setViewMode] = useState<'Full' | '1' | '2' | '3'>('Full');
  const [splits, setSplits] = useState<Record<string, number>>({});

  useEffect(() => {
    loadProcesses();
  }, []);

  async function loadProcesses() {
    setLoading(true);
    try {
      const response = await api.get('/processes');
      setProcesses(response.data);
      
      const initialSplits: Record<string, number> = {};
      response.data.forEach((p: Process) => {
        initialSplits[`p-${p.id}`] = 100;
        const subs = p.subprocesses || []; 
        subs.forEach((s: Subprocess) => {
          initialSplits[`s-${s.id}`] = 100;
        });
      });
      setSplits(prev => Object.keys(prev).length === 0 ? initialSplits : prev);
    } catch (error) {
      console.error("Erro ao carregar processos", error);
    } finally {
      setLoading(false);
    }
  }

  // --- IMPORTAR FORECAST ---
  async function handleImportForecast() {
    if (!startDate || !endDate) return alert("Selecione a data inicial e final.");
    if (startDate > endDate) return alert("A data inicial não pode ser maior que a final.");

    setImporting(true);
    try {
        let allData: MonthlyForecastItem[] = [];
        const startD = new Date(startDate);
        const endD = new Date(endDate);
        
        let currentIterDate = new Date(startD.getFullYear(), startD.getMonth(), 1);
        const finalIterDate = new Date(endD.getFullYear(), endD.getMonth(), 1);

        while (currentIterDate <= finalIterDate) {
            const year = currentIterDate.getFullYear();
            const month = currentIterDate.getMonth() + 1;
            try {
                const response = await api.get<ForecastResponse>('/forecast/monthly', { params: { year, month } });
                if (response.data?.data) allData = [...allData, ...response.data.data];
            } catch (err) { console.warn(`Sem dados para ${month}/${year}`); }
            currentIterDate.setMonth(currentIterDate.getMonth() + 1);
        }

        const daysInRange = allData.filter(item => {
            const itemDate = item.date.split('T')[0];
            return itemDate >= startDate && itemDate <= endDate;
        });

        if (daysInRange.length > 0) {
            let sumIn = 0;
            let sumOut = 0;
            daysInRange.forEach(item => {
               if (selectedWarehouse === 'RC') {
                   sumIn += item.rcRecebimento;
               } else {
                   sumIn += item.inboundM03;
                   sumOut += item.outboundM03;
               }
            });

            const avgIn = sumIn / daysInRange.length;
            const avgOut = sumOut / daysInRange.length;

            setVolInbound(Math.round(avgIn * 1000));
            setVolOutbound(Math.round(avgOut * 1000));
            alert(`Forecast Importado: ${daysInRange.length} dias considerados.`);
        } else {
            alert(`Nenhum dado encontrado.`);
        }
    } catch (error) {
        alert("Erro de conexão.");
    } finally {
        setImporting(false);
    }
  }

  // --- CÁLCULO PRINCIPAL ---
  const tableRows: PlanRow[] = useMemo(() => {
    const rows: PlanRow[] = [];
    let shiftMultiplier = 1; 
    if (viewMode === '1') shiftMultiplier = shiftDist.s1 / 100;
    if (viewMode === '2') shiftMultiplier = shiftDist.s2 / 100;
    if (viewMode === '3') shiftMultiplier = shiftDist.s3 / 100;

    const filteredProcesses = processes.filter(p => {
        if (selectedWarehouse === 'All') return true;
        return !p.warehouse || p.warehouse === selectedWarehouse;
    });

    filteredProcesses.forEach(proc => {
      const baseVol = proc.type === 'Inbound' ? volInbound : volOutbound;
      const macroVol = baseVol * shiftMultiplier;

      const pKey = `p-${proc.id}`;
      const pSplit = splits[pKey] ?? 100;
      const pVol = macroVol * (pSplit / 100);
      
      // 1. APLICAÇÃO DA EFICIÊNCIA (Sem Fadiga)
      const efficiencyFactor = proc.efficiency ?? 1; 
      const realUPH = proc.standardProductivity * efficiencyFactor;

      // 2. CÁLCULO DAS HORAS NECESSÁRIAS
      const pHoursNeeded = realUPH > 0 ? pVol / realUPH : 0;
      
      // 3. APLICAÇÃO DO DESLOCAMENTO NA JORNADA
      const travelMinutesPerHour = proc.travelTime || 0;
      // Minutos totais perdidos na jornada = (Minutos/Hora) * HorasJornada
      // Ex: 5 min/h * 7.33h = ~36 min
      const totalTravelHours = (travelMinutesPerHour * workingHours) / 60;
      
      const netWorkingHours = Math.max(0.1, workingHours - totalTravelHours);

      // 4. HC BASE
      const pHcBase = netWorkingHours > 0 ? pHoursNeeded / netWorkingHours : 0;
      
      // 5. HC FINAL (Absenteísmo)
      const pHcFinal = Math.ceil(pHcBase * (1 + (absFactor / 100)));

      rows.push({
        uniqueKey: pKey,
        type: 'Process',
        id: proc.id,
        name: proc.name,
        operationType: proc.type,
        warehouse: proc.warehouse,
        metaBase: proc.standardProductivity,
        metaReal: realUPH,
        travelTime: proc.travelTime || 0,
        splitPercentage: pSplit,
        volumeCalculated: pVol,
        hours: pHoursNeeded,
        hcBase: pHcBase,
        hcFinal: pHcFinal
      });

      // --- SUBPROCESSOS ---
      const subs = proc.subprocesses || []; 
      subs.forEach(sub => {
        const sKey = `s-${sub.id}`;
        const sSplit = splits[sKey] ?? 100; 
        const sVol = macroVol * (sSplit / 100);

        // 1. Eficiência
        const sEffFactor = sub.efficiency ?? 1;
        const sRealUPH = sub.standardProductivity * sEffFactor;

        // 2. Horas Necessárias
        const sHoursNeeded = sRealUPH > 0 ? sVol / sRealUPH : 0;

        // 3. Deslocamento
        const sTravelMinutesPerHour = sub.travelTime || 0;
        const sTotalTravelHours = (sTravelMinutesPerHour * workingHours) / 60;
        const sNetWorkingHours = Math.max(0.1, workingHours - sTotalTravelHours);

        // 4. HC
        const sHcBase = sNetWorkingHours > 0 ? sHoursNeeded / sNetWorkingHours : 0;
        const sHcFinal = Math.ceil(sHcBase * (1 + (absFactor / 100)));

        rows.push({
          uniqueKey: sKey,
          type: 'Subprocess',
          parentId: proc.id,
          id: sub.id,
          name: sub.name,
          operationType: proc.type,
          warehouse: proc.warehouse, 
          metaBase: sub.standardProductivity,
          metaReal: sRealUPH,
          travelTime: sub.travelTime || 0,
          splitPercentage: sSplit,
          volumeCalculated: sVol,
          hours: sHoursNeeded,
          hcBase: sHcBase,
          hcFinal: sHcFinal
        });
      });
    });

    return rows;
  }, [processes, volInbound, volOutbound, workingHours, absFactor, splits, viewMode, shiftDist, selectedWarehouse]);

  const handleSplitChange = (key: string, newValue: string) => {
    const val = parseFloat(newValue);
    setSplits(prev => ({ ...prev, [key]: isNaN(val) ? 0 : val }));
  };

  const handleExport = () => {
    const headers = ["Processo", "Tipo", "CD", "Meta Base", "Meta Real", "Desloc(min/h)", "% Vol", "Volume", "Horas Nec.", "HC Final"];
    const csvRows = tableRows.map(row => {
      const name = row.type === 'Subprocess' ? ` > ${row.name}` : row.name;
      
      return [
        `"${name}"`, 
        row.operationType,
        row.warehouse || '-',
        row.metaBase,
        row.metaReal.toFixed(1),
        row.travelTime,
        `${row.splitPercentage}%`,
        Math.round(row.volumeCalculated),
        row.hours.toFixed(2),
        row.hcFinal.toFixed(0)
      ].join(";");
    });
    const csvContent = "\uFEFF" + [headers.join(";"), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Planejamento_${startDate}_${viewMode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalHC = tableRows.reduce((acc, row) => acc + row.hcFinal, 0);

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.6s ease-out; }
        .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%); background-size: 1000px 100%; animation: shimmer 2s infinite; }
        @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
        .card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .input-focus:focus { transform: translateY(-2px); }
        .input-focus { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .btn-hover { position: relative; overflow: hidden; transition: all 0.3s; }
        .btn-hover:active { transform: scale(0.95); }
        .table-row:hover { background: rgba(212, 5, 17, 0.02) !important; }
        .table-row { transition: all 0.2s; }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-8">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-20">
          
          {/* HEADER PRINCIPAL */}
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-dhl-red/5 to-dhl-yellow/5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-dhl-yellow/5 to-dhl-red/5 rounded-full blur-3xl"></div>
            
            <div className="relative p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-dhl-red to-red-600 rounded-2xl blur opacity-50"></div>
                    <div className="relative w-16 h-16 bg-gradient-to-br from-dhl-red to-red-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300">
                      <FileSpreadsheet className="text-white" size={32} />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      Planejamento Diário
                    </h1>
                    <p className="text-gray-500 mt-1 flex items-center gap-2">
                      <Zap size={14} className="text-dhl-yellow" />
                      <span>
                        Visão: <span className="font-bold text-dhl-red">{viewMode === 'Full' ? 'Dia Completo' : `${viewMode}º Turno`}</span>
                        <span className="mx-2">|</span>
                        Warehouse: <span className="font-bold text-blue-600">{selectedWarehouse}</span>
                      </span>
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col xl:flex-row items-stretch gap-3">
                  <div className="flex gap-3">
                    <button 
                        onClick={handleImportForecast}
                        disabled={importing}
                        className="btn-hover bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex-1 whitespace-nowrap"
                    >
                        {importing ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <CloudDownload size={20} />}
                        <span className="hidden sm:inline">Importar</span>
                    </button>

                    <button 
                        onClick={handleExport}
                        className="btn-hover bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl flex-1"
                    >
                        <Download size={20} /> <span className="hidden sm:inline">Exportar</span>
                    </button>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-wrap xl:flex-nowrap">
                      <div className="p-3 bg-gradient-to-br from-gray-50 to-white flex flex-col justify-center border-r border-gray-200 min-w-[120px] flex-1">
                        <div className="flex items-center gap-1 mb-1">
                            <CalendarRange size={12} className="text-gray-400"/>
                            <p className="text-[10px] font-bold text-gray-500 uppercase">De</p>
                        </div>
                        <input type="date" className="font-bold text-gray-800 bg-transparent outline-none cursor-pointer text-xs sm:text-sm w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
                      </div>

                      <div className="p-3 bg-gradient-to-br from-gray-50 to-white flex flex-col justify-center border-r border-gray-200 min-w-[120px] flex-1">
                        <div className="flex items-center gap-1 mb-1">
                            <CalendarRange size={12} className="text-gray-400"/>
                            <p className="text-[10px] font-bold text-gray-500 uppercase">Até</p>
                        </div>
                        <input type="date" className="font-bold text-gray-800 bg-transparent outline-none cursor-pointer text-xs sm:text-sm w-full" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
                      </div>

                      <div className="p-3 bg-gradient-to-br from-gray-50 to-white flex flex-col justify-center border-r border-gray-200 min-w-[100px] flex-1">
                        <div className="flex items-center gap-1 mb-1">
                            <Warehouse size={12} className="text-gray-400"/>
                            <p className="text-[10px] font-bold text-gray-500 uppercase">CD</p>
                        </div>
                        <select className="bg-transparent font-bold text-gray-700 outline-none cursor-pointer text-xs sm:text-sm w-full" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                          <option value="All">Todos</option>
                          <option value="M03">M03</option>
                          <option value="RC">RC</option>
                        </select>
                      </div>
                      
                      <div className="p-3 bg-gradient-to-br from-gray-50 to-white flex flex-col justify-center min-w-[110px] flex-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Visão</p>
                        <select className="bg-transparent font-bold text-gray-700 outline-none cursor-pointer text-xs sm:text-sm w-full" value={viewMode} onChange={e => setViewMode(e.target.value as any)}>
                          <option value="Full">Full Day</option>
                          <option value="1">1º Turno</option>
                          <option value="2">2º Turno</option>
                          <option value="3">3º Turno</option>
                        </select>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PARÂMETROS MACRO */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden card-hover">
            <div className="bg-gradient-to-br from-dhl-yellow via-yellow-400 to-yellow-500 p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                    <Box className="text-white" size={22} />
                  </div>
                  <div>
                    <h2 className="font-bold text-2xl text-white drop-shadow-lg">Volumes e Parâmetros</h2>
                    <p className="text-white/90 text-sm mt-0.5">Configure os dados base do planejamento</p>
                  </div>
                </div>
                
                {/* CONFIGURAÇÃO DE TURNOS */}
                  <div className="bg-gradient-to-br from-dhl-red/25 to-dhl-yellow/25 backdrop-blur-sm rounded-xl p-3 border border-white/40 shadow-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <PieChart size={16} className="text-white" />
                    <span className="text-xs font-bold text-white uppercase">Distribuição de Turnos</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-dhl-red/30 to-dhl-yellow/30 px-2 py-1 rounded-lg border border-white/30">
                      <span className="text-xs font-bold text-white">T1</span>
                      <input type="number" className="w-12 px-1 py-0.5 text-center border-2 border-white/50 bg-white/10 rounded text-xs font-black text-white outline-none" onChange={e => setShiftDist({...shiftDist, s1: Number(e.target.value)})} value={shiftDist.s1} />
                    </div>
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-dhl-red/30 to-dhl-yellow/30 px-2 py-1 rounded-lg border border-white/30">
                      <span className="text-xs font-bold text-white">T2</span>
                      <input type="number" className="w-12 px-1 py-0.5 text-center border-2 border-white/50 bg-white/10 rounded text-xs font-black text-white outline-none" onChange={e => setShiftDist({...shiftDist, s2: Number(e.target.value)})} value={shiftDist.s2} />
                    </div>
                      <div className="flex items-center gap-1.5 bg-gradient-to-r from-dhl-red/30 to-dhl-yellow/30 px-2 py-1 rounded-lg border border-white/30">
                      <span className="text-xs font-bold text-white">T3</span>
                      <input type="number" className="w-12 px-1 py-0.5 text-center border-2 border-white/50 bg-white/10 rounded text-xs font-black text-white outline-none" onChange={e => setShiftDist({...shiftDist, s3: Number(e.target.value)})} value={shiftDist.s3} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-200 overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-green-200 rounded-full -mr-12 -mt-12 opacity-20 group-hover:scale-150 transition-transform duration-500"></div>
                  <label className="text-xs font-bold text-green-700 uppercase mb-3 flex items-center gap-2 relative z-10">
                    <ArrowDownCircle size={16} /> Total Inbound (Média)
                  </label>
                  <input type="number" className="input-focus w-full text-3xl font-black text-green-800 bg-white/50 border-2 border-green-300 rounded-xl px-4 py-3 focus:border-green-500 outline-none transition-all relative z-10" placeholder="0" value={volInbound || ''} onChange={e => setVolInbound(Number(e.target.value))} />
                </div>

                <div className="relative bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border-2 border-blue-200 overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-200 rounded-full -mr-12 -mt-12 opacity-20 group-hover:scale-150 transition-transform duration-500"></div>
                  <label className="text-xs font-bold text-blue-700 uppercase mb-3 flex items-center gap-2 relative z-10">
                    <ArrowUpCircle size={16} /> Total Outbound (Média)
                  </label>
                  <input type="number" className="input-focus w-full text-3xl font-black text-blue-800 bg-white/50 border-2 border-blue-300 rounded-xl px-4 py-3 focus:border-blue-500 outline-none transition-all relative z-10" placeholder="0" value={volOutbound || ''} onChange={e => setVolOutbound(Number(e.target.value))} />
                </div>

                <div className="relative bg-gradient-to-br from-gray-50 to-slate-50 p-6 rounded-xl border-2 border-gray-200 overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gray-200 rounded-full -mr-12 -mt-12 opacity-20 group-hover:scale-150 transition-transform duration-500"></div>
                  <label className="text-xs font-bold text-gray-700 uppercase mb-3 flex items-center gap-2 relative z-10">
                    <Clock size={16} /> Jornada (Horas)
                  </label>
                  <input type="number" step="0.01" className="input-focus w-full text-3xl font-black text-gray-800 bg-white/50 border-2 border-gray-300 rounded-xl px-4 py-3 text-center focus:border-gray-500 outline-none transition-all relative z-10" value={workingHours} onChange={e => setWorkingHours(Number(e.target.value))} />
                </div>

                <div className="relative bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-xl border-2 border-red-200 overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-200 rounded-full -mr-12 -mt-12 opacity-20 group-hover:scale-150 transition-transform duration-500"></div>
                  <label className="text-xs font-bold text-red-700 uppercase mb-3 flex items-center gap-2 relative z-10">
                    <ShieldAlert size={16} /> Fator ABS (%)
                  </label>
                  <div className="flex items-center justify-center gap-2 relative z-10">
                    <input type="number" className="input-focus flex-1 text-3xl font-black leading-none text-red-800 bg-white/50 border-2 border-red-300 rounded-xl px-3 py-2.5 text-center focus:border-red-500 outline-none transition-all" value={absFactor} onChange={e => setAbsFactor(Number(e.target.value))} />
                    <span className="text-2xl font-bold text-red-700">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARDS DE RESULTADO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ResultCard title="Headcount Necessário" value={tableRows.reduce((acc, row) => acc + row.hcFinal, 0)} subtitle={viewMode === 'Full' ? "Total do Dia (Todos os Turnos)" : `Para o ${viewMode}º Turno apenas`} color="bg-gradient-to-br from-dhl-red to-red-600 text-white" icon={<Users />} />
            <ResultCard title="Equipe Inbound" value={tableRows.filter(r => r.operationType === 'Inbound').reduce((acc, row) => acc + row.hcFinal, 0)} color="bg-white text-green-700 border-2 border-green-500 shadow-lg shadow-green-500/20" icon={<ArrowDownCircle />} />
            <ResultCard title="Equipe Outbound" value={tableRows.filter(r => r.operationType === 'Outbound').reduce((acc, row) => acc + row.hcFinal, 0)} color="bg-white text-blue-700 border-2 border-blue-500 shadow-lg shadow-blue-500/20" icon={<ArrowUpCircle />} />
          </div>

          {/* TABELA DETALHADA */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-dhl-red to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                    <TrendingUp className="text-white" size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-gray-900">Detalhamento do Planejamento</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Cálculo completo com Eficiência e Deslocamento</p>
                  </div>
                </div>
              </div>
              <button onClick={loadProcesses} className="group relative inline-flex items-center justify-center w-10 h-10 text-gray-400 hover:text-white transition-all duration-300 rounded-xl overflow-hidden shadow-sm hover:shadow-lg">
                <div className="absolute inset-0 bg-dhl-red transform scale-0 group-hover:scale-100 transition-transform duration-300 rounded-xl"></div>
                <RefreshCw size={18} className="relative z-10" />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Processo</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Meta Base</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-blue-600 uppercase tracking-wider">Meta Real</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Desloc. (min/h)</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider w-24">% Vol.</th> 
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Volume</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wider bg-gray-100">HC Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={8} className="p-12 text-center"><div className="flex flex-col items-center gap-3"><RefreshCw className="animate-spin text-dhl-red" size={32} /><span className="text-gray-500 font-medium">Carregando...</span></div></td></tr>
                  ) : tableRows.length === 0 ? (
                    <tr><td colSpan={8} className="p-12 text-center"><div className="flex flex-col items-center gap-3"><div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center"><FileSpreadsheet className="text-gray-400" size={32} /></div><span className="text-gray-500 font-medium">Nenhum processo encontrado com este filtro</span></div></td></tr>
                  ) : (
                    tableRows.map((row, index) => (
                      <tr key={row.uniqueKey} className={`table-row ${row.type === 'Process' ? 'bg-white' : 'bg-gray-50/50'}`} style={{ animation: `fadeInUp 0.3s ease-out ${index * 0.02}s both` }}>
                        <td className="px-6 py-4">
                          {row.type === 'Process' ? (
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-10 bg-gradient-to-b from-dhl-red to-dhl-yellow rounded-full"></div>
                              <span className="font-bold text-gray-900 text-base">{row.name}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 pl-8">
                              <CornerDownRight size={16} className="text-gray-400" />
                              <span className="font-medium text-gray-600">{row.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                            {row.type === 'Process' && (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm ${row.operationType === 'Inbound' ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200' : 'bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 border border-blue-200'}`}>
                                    {row.operationType === 'Inbound' ? '📥' : '📤'}
                                </span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-gray-400">{row.metaBase}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-blue-600">{row.metaReal.toFixed(0)}</td>
                        <td className="px-6 py-4 text-center text-gray-500 font-medium">{row.travelTime > 0 ? row.travelTime + "'" : '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input type="number" min="0" max="999" className={`w-14 px-2 py-1.5 text-center border-2 rounded-lg outline-none font-bold text-xs transition-all ${row.type === 'Process' ? 'border-gray-300 text-gray-700 bg-white hover:border-gray-400 focus:border-dhl-yellow' : 'border-blue-300 text-blue-700 bg-blue-50/30 hover:border-blue-400 focus:border-blue-500'}`} value={row.splitPercentage} onChange={(e) => handleSplitChange(row.uniqueKey, e.target.value)} />
                            <Percent size={12} className="text-gray-400" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-700">{Math.round(row.volumeCalculated).toLocaleString()}</td>
                        <td className={`px-6 py-4 text-center border-l-2 border-gray-200 ${row.type === 'Process' ? 'bg-gray-50' : ''}`}>
                          <div className="flex items-center justify-center gap-2">
                            {row.hcFinal > 0 ? (<><Users size={16} className={row.type === 'Process' ? "text-dhl-red" : "text-gray-400"} /><span className={`text-xl ${row.type === 'Process' ? "font-black text-dhl-red" : "font-bold text-gray-600"}`}>{row.hcFinal.toFixed(1)}</span></>) : (<span className="text-gray-300 text-lg">-</span>)}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {tableRows.length > 0 && (
                  <tfoot className="bg-gray-100 font-bold text-gray-700">
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-right uppercase text-xs">Total HC:</td>
                      <td className="px-6 py-4 text-center text-xl text-dhl-red">
                        {tableRows.reduce((acc, row) => acc + row.hcFinal, 0).toFixed(1)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ResultCard({ title, value, subtitle, color, icon }: any) {
  return (
    <div className={`card-hover relative p-8 rounded-2xl shadow-xl flex items-center justify-between overflow-hidden ${color}`}>
      <div className="absolute inset-0 shimmer"></div>
      <div className="relative z-10">
        <p className="text-sm opacity-90 uppercase font-bold mb-2 tracking-wide">{title}</p>
        <p className="text-5xl font-black mb-1">{value.toFixed(1)}</p>
        {subtitle && <p className="text-xs opacity-80 mt-2 font-medium">{subtitle}</p>}
      </div>
      <div className="relative z-10 opacity-20 transform scale-150">{icon}</div>
    </div>
  );
}