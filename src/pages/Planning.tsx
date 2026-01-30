import { useState, useEffect, useMemo } from 'react';
import { api } from '../Services/api';
import { 
  Users, Clock, ArrowDownCircle, ArrowUpCircle, 
  Save, RefreshCw, FileSpreadsheet, Box, ShieldAlert, Percent,
  CornerDownRight, Download, PieChart, Zap, TrendingUp
} from 'lucide-react';

// --- INTERFACES ---
interface Subprocess {
  id: number;
  name: string;
  standardProductivity: number;
  processId: number;
}

interface Process {
  id: number;
  name: string;
  type: 'Inbound' | 'Outbound';
  standardProductivity: number;
  subprocesses: Subprocess[];
}

interface PlanRow {
  uniqueKey: string;
  type: 'Process' | 'Subprocess';
  parentId?: number;
  
  id: number;
  name: string;
  operationType: 'Inbound' | 'Outbound';
  meta: number;
  
  splitPercentage: number;
  volumeCalculated: number;
  
  hours: number;
  hcBase: number;
  hcFinal: number;
}

export function Planning() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(false);
  
  // --- CONFIGURAÇÕES GERAIS ---
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [workingHours, setWorkingHours] = useState(7.33); 
  const [absFactor, setAbsFactor] = useState(0); 

  // --- VOLUMES TOTAIS (DIA) ---
  const [volInbound, setVolInbound] = useState<number>(0);
  const [volOutbound, setVolOutbound] = useState<number>(0);

  // --- CONTROLE DE TURNOS (NOVO) ---
  const [shiftDist, setShiftDist] = useState({ s1: 40, s2: 40, s3: 20 }); // Padrão: 40/40/20
  const [viewMode, setViewMode] = useState<'Full' | '1' | '2' | '3'>('Full'); // O que estamos vendo agora?

  // --- CONTROLE DE PORCENTAGEM DE PROCESSO ---
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

  // --- CÁLCULO PRINCIPAL ---
  const tableRows: PlanRow[] = useMemo(() => {
    const rows: PlanRow[] = [];

    // 1. Define o Multiplicador do Turno (Baseado no ViewMode)
    let shiftMultiplier = 1; // Padrão Dia Completo (100%)
    if (viewMode === '1') shiftMultiplier = shiftDist.s1 / 100;
    if (viewMode === '2') shiftMultiplier = shiftDist.s2 / 100;
    if (viewMode === '3') shiftMultiplier = shiftDist.s3 / 100;

    processes.forEach(proc => {
      // Volume Total do Dia
      const dayVol = proc.type === 'Inbound' ? volInbound : volOutbound;
      
      // Volume Considerado (Aplica o Turno)
      const macroVol = dayVol * shiftMultiplier;

      // --- CÁLCULO DO PAI ---
      const pKey = `p-${proc.id}`;
      const pSplit = splits[pKey] ?? 100;
      const pVol = macroVol * (pSplit / 100);
      
      const pHours = proc.standardProductivity > 0 ? pVol / proc.standardProductivity : 0;
      const pHcBase = workingHours > 0 ? pHours / workingHours : 0;
      const pHcFinal = pHcBase * (1 + (absFactor / 100));

      rows.push({
        uniqueKey: pKey,
        type: 'Process',
        id: proc.id,
        name: proc.name,
        operationType: proc.type,
        meta: proc.standardProductivity,
        splitPercentage: pSplit,
        volumeCalculated: pVol,
        hours: pHours,
        hcBase: pHcBase,
        hcFinal: pHcFinal
      });

      // --- CÁLCULO DOS FILHOS ---
      const subs = proc.subprocesses || []; 
      subs.forEach(sub => {
        const sKey = `s-${sub.id}`;
        const sSplit = splits[sKey] ?? 100; 
        const sVol = macroVol * (sSplit / 100);

        const sHours = sub.standardProductivity > 0 ? sVol / sub.standardProductivity : 0;
        const sHcBase = workingHours > 0 ? sHours / workingHours : 0;
        const sHcFinal = sHcBase * (1 + (absFactor / 100));

        rows.push({
          uniqueKey: sKey,
          type: 'Subprocess',
          parentId: proc.id,
          id: sub.id,
          name: sub.name,
          operationType: proc.type, 
          meta: sub.standardProductivity,
          splitPercentage: sSplit,
          volumeCalculated: sVol,
          hours: sHours,
          hcBase: sHcBase,
          hcFinal: sHcFinal
        });
      });
    });

    return rows;
  }, [processes, volInbound, volOutbound, workingHours, absFactor, splits, viewMode, shiftDist]);

  const handleSplitChange = (key: string, newValue: string) => {
    const val = parseFloat(newValue);
    setSplits(prev => ({ ...prev, [key]: isNaN(val) ? 0 : val }));
  };

  // --- FUNÇÃO DE EXPORTAÇÃO (CSV) ---
  const handleExport = () => {
    // Cabeçalho do CSV
    const headers = ["Processo", "Tipo", "Meta UPH", "% Aplicada", "Volume Calc", "Horas", "HC Final"];
    
    // Linhas de dados
    const csvRows = tableRows.map(row => {
      const name = row.type === 'Subprocess' ? `  > ${row.name}` : row.name;
      return [
        `"${name}"`, 
        row.operationType,
        row.meta,
        `${row.splitPercentage}%`,
        Math.round(row.volumeCalculated),
        row.hours.toFixed(2).replace('.', ','),
        row.hcFinal.toFixed(2).replace('.', ',')
      ].join(";");
    });

    // Junta tudo com BOM para o Excel ler acentos
    const csvContent = "\uFEFF" + [headers.join(";"), ...csvRows].join("\n");
    
    // Cria o blob e baixa
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Planejamento_${selectedDate}_${viewMode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- TOTAIS ---
  const totalHC = tableRows.reduce((acc, row) => acc + row.hcFinal, 0);
  const totalInboundHC = tableRows.filter(r => r.operationType === 'Inbound').reduce((acc, row) => acc + row.hcFinal, 0);
  const totalOutboundHC = tableRows.filter(r => r.operationType === 'Outbound').reduce((acc, row) => acc + row.hcFinal, 0);

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }

        .animate-scale-in {
          animation: scaleIn 0.3s ease-out;
        }

        .shimmer {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }

        .card-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .input-focus {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .input-focus:focus {
          transform: translateY(-2px);
        }

        .btn-hover {
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn-hover::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }

        .btn-hover:hover::before {
          width: 300px;
          height: 300px;
        }

        .btn-hover:active {
          transform: scale(0.95);
        }

        .table-row {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .table-row:hover {
          background: rgba(212, 5, 17, 0.02) !important;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-8">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-20">
          
          {/* HEADER PRINCIPAL */}
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Fundo decorativo */}
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
                      <span>Visualizando: <span className="font-bold text-dhl-red">{viewMode === 'Full' ? 'Dia Completo' : `${viewMode}º Turno`}</span></span>
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* BOTÃO EXPORTAR */}
                  <button 
                    onClick={handleExport}
                    className="btn-hover bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <Download size={20} /> Exportar Excel
                    </span>
                  </button>

                  {/* SELETOR DE DATA E VIEW MODE */}
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="flex items-stretch divide-x divide-gray-200">
                      <div className="p-4 bg-gradient-to-br from-gray-50 to-white">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Data Referência</p>
                        <input 
                          type="date" 
                          className="font-bold text-gray-800 bg-transparent outline-none cursor-pointer"
                          value={selectedDate}
                          onChange={e => setSelectedDate(e.target.value)}
                        />
                      </div>
                      
                      <div className="p-4 bg-gradient-to-br from-gray-50 to-white">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Visão</p>
                        <select 
                          className="bg-transparent font-bold text-gray-700 outline-none cursor-pointer"
                          value={viewMode}
                          onChange={e => setViewMode(e.target.value as any)}
                        >
                          <option value="Full">📊 Dia Completo</option>
                          <option value="1">🌅 1º Turno</option>
                          <option value="2">☀️ 2º Turno</option>
                          <option value="3">🌙 3º Turno</option>
                        </select>
                      </div>
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
                      <input 
                        type="number" 
                        className="w-12 px-1 py-0.5 text-center border-2 border-white/50 bg-white/10 rounded text-xs font-black text-white placeholder-white/70 outline-none focus:border-white transition-all"
                        onChange={e => setShiftDist({...shiftDist, s1: Number(e.target.value)})} 
                      />
                      <span className="text-xs text-white/80">%</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-dhl-red/30 to-dhl-yellow/30 px-2 py-1 rounded-lg border border-white/30">
                      <span className="text-xs font-bold text-white">T2</span>
                      <input 
                        type="number" 
                        className="w-12 px-1 py-0.5 text-center border-2 border-white/50 bg-white/10 rounded text-xs font-black text-white placeholder-white/70 outline-none focus:border-white transition-all"
                        onChange={e => setShiftDist({...shiftDist, s2: Number(e.target.value)})} 
                      />
                      <span className="text-xs text-white/80">%</span>
                    </div>
                      <div className="flex items-center gap-1.5 bg-gradient-to-r from-dhl-red/30 to-dhl-yellow/30 px-2 py-1 rounded-lg border border-white/30">
                      <span className="text-xs font-bold text-white">T3</span>
                      <input 
                        type="number" 
                        className="w-12 px-1 py-0.5 text-center border-2 border-white/50 bg-white/10 rounded text-xs font-black text-white placeholder-white/70 outline-none focus:border-white transition-all"
                        onChange={e => setShiftDist({...shiftDist, s3: Number(e.target.value)})} 
                      />
                      <span className="text-xs text-white/80">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* INBOUND */}
                <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-200 overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-green-200 rounded-full -mr-12 -mt-12 opacity-20 group-hover:scale-150 transition-transform duration-500"></div>
                  <label className="text-xs font-bold text-green-700 uppercase mb-3 flex items-center gap-2 relative z-10">
                    <ArrowDownCircle size={16} /> Total Inbound (Dia)
                  </label>
                  <input 
                    type="number" 
                    className="input-focus w-full text-3xl font-black text-green-800 bg-white/50 border-2 border-green-300 rounded-xl px-4 py-3 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 outline-none transition-all relative z-10"
                    placeholder="0"
                    value={volInbound || ''}
                    onChange={e => setVolInbound(Number(e.target.value))}
                  />
                </div>

                {/* OUTBOUND */}
                <div className="relative bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border-2 border-blue-200 overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-200 rounded-full -mr-12 -mt-12 opacity-20 group-hover:scale-150 transition-transform duration-500"></div>
                  <label className="text-xs font-bold text-blue-700 uppercase mb-3 flex items-center gap-2 relative z-10">
                    <ArrowUpCircle size={16} /> Total Outbound (Dia)
                  </label>
                  <input 
                    type="number" 
                    className="input-focus w-full text-3xl font-black text-blue-800 bg-white/50 border-2 border-blue-300 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all relative z-10"
                    placeholder="0"
                    value={volOutbound || ''}
                    onChange={e => setVolOutbound(Number(e.target.value))}
                  />
                </div>

                {/* JORNADA */}
                <div className="relative bg-gradient-to-br from-gray-50 to-slate-50 p-6 rounded-xl border-2 border-gray-200 overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gray-200 rounded-full -mr-12 -mt-12 opacity-20 group-hover:scale-150 transition-transform duration-500"></div>
                  <label className="text-xs font-bold text-gray-700 uppercase mb-3 flex items-center gap-2 relative z-10">
                    <Clock size={16} /> Jornada (Horas)
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-focus w-full text-3xl font-black text-gray-800 bg-white/50 border-2 border-gray-300 rounded-xl px-4 py-3 text-center focus:border-gray-500 focus:ring-4 focus:ring-gray-500/20 outline-none transition-all relative z-10"
                    value={workingHours}
                    onChange={e => setWorkingHours(Number(e.target.value))}
                  />
                </div>

                {/* FATOR ABS */}
                <div className="relative bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-xl border-2 border-red-200 overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-200 rounded-full -mr-12 -mt-12 opacity-20 group-hover:scale-150 transition-transform duration-500"></div>
                  <label className="text-xs font-bold text-red-700 uppercase mb-3 flex items-center gap-2 relative z-10">
                    <ShieldAlert size={16} /> Fator ABS (%)
                  </label>
                  <div className="flex items-center justify-center gap-2 relative z-10">
                    <input 
                      type="number" 
                      className="input-focus flex-1 text-3xl font-black leading-none text-red-800 bg-white/50 border-2 border-red-300 rounded-xl px-3 py-2.5 text-center focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      value={absFactor}
                      onChange={e => setAbsFactor(Number(e.target.value))}
                    />
                    <span className="text-2xl font-bold text-red-700">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARDS DE RESULTADO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ResultCard 
              title="Headcount Necessário" 
              value={totalHC} 
              subtitle={viewMode === 'Full' ? "Total do Dia (Todos os Turnos)" : `Para o ${viewMode}º Turno apenas`}
              color="bg-gradient-to-br from-dhl-red to-red-600 text-white" 
              icon={<Users />} 
            />
            <ResultCard 
              title="Equipe Inbound" 
              value={totalInboundHC} 
              color="bg-white text-green-700 border-2 border-green-500 shadow-lg shadow-green-500/20" 
              icon={<ArrowDownCircle />} 
            />
            <ResultCard 
              title="Equipe Outbound" 
              value={totalOutboundHC} 
              color="bg-white text-blue-700 border-2 border-blue-500 shadow-lg shadow-blue-500/20" 
              icon={<ArrowUpCircle />} 
            />
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
                    <p className="text-sm text-gray-500 mt-0.5">Cálculo completo por processo e subprocesso</p>
                  </div>
                </div>
                {viewMode !== 'Full' && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-dhl-yellow/20 border-2 border-dhl-yellow text-dhl-red px-3 py-1.5 rounded-lg text-xs font-bold animate-pulse">
                    <Zap size={14} />
                    Filtrado: {viewMode}º Turno ({shiftDist[`s${viewMode}` as keyof typeof shiftDist]}% do Volume)
                  </div>
                )}
              </div>
              <button 
                onClick={loadProcesses} 
                className="group relative inline-flex items-center justify-center w-10 h-10 text-gray-400 hover:text-white transition-all duration-300 rounded-xl overflow-hidden shadow-sm hover:shadow-lg"
              >
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
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Meta</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider w-28">% Vol. Proc.</th> 
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Volume</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Horas</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-800 uppercase tracking-wider bg-gray-100">HC Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw className="animate-spin text-dhl-red" size={32} />
                          <span className="text-gray-500 font-medium">Carregando dados...</span>
                        </div>
                      </td>
                    </tr>
                  ) : tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                            <FileSpreadsheet className="text-gray-400" size={32} />
                          </div>
                          <span className="text-gray-500 font-medium">Nenhum processo cadastrado</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((row, index) => (
                      <tr 
                        key={row.uniqueKey} 
                        className={`table-row ${
                          row.type === 'Process' ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                        style={{ animation: `fadeInUp 0.3s ease-out ${index * 0.02}s both` }}
                      >
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
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm ${
                              row.operationType === 'Inbound' 
                                ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200' 
                                : 'bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 border border-blue-200'
                            }`}>
                              {row.operationType === 'Inbound' ? '📥' : '📤'} {row.operationType}
                            </span>
                          )}
                        </td>
                        
                        <td className="px-6 py-4 text-right text-gray-600 font-mono font-bold">
                          {row.meta}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input 
                              type="number" 
                              min="0" 
                              max="999"
                              className={`w-14 px-2 py-1.5 text-center border-2 rounded-lg outline-none font-bold text-xs transition-all ${
                                row.type === 'Process' 
                                  ? 'border-gray-300 text-gray-700 bg-white hover:border-gray-400 focus:border-dhl-yellow focus:ring-2 focus:ring-dhl-yellow/20' 
                                  : 'border-blue-300 text-blue-700 bg-blue-50/30 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                              }`}
                              value={row.splitPercentage}
                              onChange={(e) => handleSplitChange(row.uniqueKey, e.target.value)}
                            />
                            <Percent size={12} className="text-gray-400" />
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right font-bold text-gray-700">
                          {row.volumeCalculated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        
                        <td className="px-6 py-4 text-right text-gray-600 font-medium">
                          {row.hours.toFixed(2)}
                        </td>
                        
                        <td className={`px-6 py-4 text-center border-l-2 border-gray-200 ${
                          row.type === 'Process' ? 'bg-gray-50' : ''
                        }`}>
                          <div className="flex items-center justify-center gap-2">
                            {row.hcFinal > 0 ? (
                              <>
                                <Users size={16} className={row.type === 'Process' ? "text-dhl-red" : "text-gray-400"} />
                                <span className={`text-xl ${
                                  row.type === 'Process' ? "font-black text-dhl-red" : "font-bold text-gray-600"
                                }`}>
                                  {row.hcFinal.toFixed(1)}
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-300 text-lg">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {!loading && tableRows.length > 0 && (
                  <tfoot className="bg-gradient-to-r from-gray-100 to-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={5} className="px-6 py-5 text-right uppercase text-xs font-bold text-gray-600 tracking-wider">
                        Total {viewMode === 'Full' ? 'Dia' : 'Turno'}:
                      </td>
                      <td className="px-6 py-5 text-right text-dhl-red font-bold text-base">
                        {tableRows.reduce((a, b) => a + b.hours, 0).toFixed(1)} h
                      </td>
                      <td className="px-6 py-5 text-center border-l-2 border-gray-300 bg-dhl-red/5">
                        <div className="flex items-center justify-center gap-2">
                          <Users size={20} className="text-dhl-red" />
                          <span className="text-3xl font-black text-dhl-red">{totalHC.toFixed(1)}</span>
                        </div>
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
      <div className="relative z-10 opacity-20 transform scale-150">
        {icon}
      </div>
    </div>
  );
}