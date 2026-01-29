import { useState, useEffect, useMemo } from 'react';
import { api } from '../Services/api';
import { 
  Users, Clock, ArrowDownCircle, ArrowUpCircle, 
  Save, RefreshCw, FileSpreadsheet, Box, ShieldAlert, Percent,
  CornerDownRight, Download, PieChart
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
    <div className="space-y-6 animate-fade-in-up pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="text-dhl-red" />
            Planejamento Diário
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Visualizando: <span className="font-bold text-dhl-red uppercase">{viewMode === 'Full' ? 'Dia Completo' : `${viewMode}º Turno`}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3">
           {/* BOTÃO EXPORTAR */}
           <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow-sm text-sm font-bold transition-colors"
          >
            <Download size={18} /> Excel
          </button>

          {/* SELETOR DE DATA E VIEW MODE */}
          <div className="flex items-center gap-3 bg-white p-2 rounded shadow-sm border border-gray-200">
            <div className="text-right px-2">
              <p className="text-xs text-gray-500 uppercase font-bold">Data Ref.</p>
              <input 
                type="date" 
                className="font-bold text-gray-800 bg-transparent outline-none text-right cursor-pointer text-sm"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="w-px h-8 bg-gray-300 mx-2"></div>
            
            {/* SELETOR DE VISÃO */}
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Visão</p>
              <select 
                className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer"
                value={viewMode}
                onChange={e => setViewMode(e.target.value as any)}
              >
                <option value="Full">Dia Completo (Total)</option>
                <option value="1">1º Turno</option>
                <option value="2">2º Turno</option>
                <option value="3">3º Turno</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* --- PARÂMETROS MACRO --- */}
      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-dhl-yellow">
        
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-gray-700 flex items-center gap-2">
            <Box size={20} /> Volumes e Parâmetros
          </h2>
          
          {/* CONFIGURAÇÃO RÁPIDA DE TURNOS */}
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
             <PieChart size={16} className="text-gray-400" />
             <span className="text-xs font-bold text-gray-500 uppercase mr-2">Distr. Turnos:</span>
             
             <div className="flex items-center gap-1">
               <span className="text-xs font-bold text-gray-400">T1:</span>
               <input type="number" className="w-10 p-1 text-center border rounded text-xs" value={shiftDist.s1} onChange={e => setShiftDist({...shiftDist, s1: Number(e.target.value)})} />
               <span className="text-xs text-gray-400">%</span>
             </div>
             <div className="flex items-center gap-1">
               <span className="text-xs font-bold text-gray-400">T2:</span>
               <input type="number" className="w-10 p-1 text-center border rounded text-xs" value={shiftDist.s2} onChange={e => setShiftDist({...shiftDist, s2: Number(e.target.value)})} />
               <span className="text-xs text-gray-400">%</span>
             </div>
             <div className="flex items-center gap-1">
               <span className="text-xs font-bold text-gray-400">T3:</span>
               <input type="number" className="w-10 p-1 text-center border rounded text-xs" value={shiftDist.s3} onChange={e => setShiftDist({...shiftDist, s3: Number(e.target.value)})} />
               <span className="text-xs text-gray-400">%</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* INBOUND (Dia Todo) */}
          <div className="bg-green-50 p-4 rounded border border-green-100">
            <label className="text-xs font-bold text-green-700 uppercase mb-1 flex items-center gap-1">
              <ArrowDownCircle size={14} /> Total Inbound (Dia)
            </label>
            <input 
              type="number" 
              className="w-full text-2xl font-bold text-green-800 bg-transparent border-b-2 border-green-200 focus:border-green-500 outline-none"
              placeholder="0"
              value={volInbound || ''}
              onChange={e => setVolInbound(Number(e.target.value))}
            />
          </div>

          {/* OUTBOUND (Dia Todo) */}
          <div className="bg-blue-50 p-4 rounded border border-blue-100">
            <label className="text-xs font-bold text-blue-700 uppercase mb-1 flex items-center gap-1">
              <ArrowUpCircle size={14} /> Total Outbound (Dia)
            </label>
            <input 
              type="number" 
              className="w-full text-2xl font-bold text-blue-800 bg-transparent border-b-2 border-blue-200 focus:border-blue-500 outline-none"
              placeholder="0"
              value={volOutbound || ''}
              onChange={e => setVolOutbound(Number(e.target.value))}
            />
          </div>

          {/* JORNADA */}
          <div className="bg-gray-50 p-4 rounded border border-gray-200 flex flex-col justify-center">
            <label className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
              <Clock size={14} /> Jornada (Horas)
            </label>
            <input 
              type="number" step="0.01"
              className="w-full p-2 border border-gray-300 rounded font-bold text-center focus:border-dhl-yellow outline-none"
              value={workingHours}
              onChange={e => setWorkingHours(Number(e.target.value))}
            />
          </div>

          {/* FATOR ABS */}
          <div className="bg-red-50 p-4 rounded border border-red-100 flex flex-col justify-center relative">
            <label className="text-xs font-bold text-red-700 uppercase mb-2 flex items-center gap-1">
              <ShieldAlert size={14} /> Fator ABS (%)
            </label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                className="w-full p-2 border border-red-200 rounded font-bold text-center text-red-700 bg-white focus:border-red-500 outline-none"
                value={absFactor}
                onChange={e => setAbsFactor(Number(e.target.value))}
              />
              <span className="font-bold text-red-700">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- CARDS DE RESULTADO --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard 
          title="Headcount Necessário" 
          value={totalHC} 
          subtitle={viewMode === 'Full' ? "Total do Dia (Todos os Turnos)" : `Para o ${viewMode}º Turno apenas`}
          color="bg-dhl-red text-white" 
          icon={<Users />} 
        />
        <ResultCard title="Equipe Inbound" value={totalInboundHC} color="bg-white text-green-700 border-l-4 border-green-500" icon={<ArrowDownCircle />} />
        <ResultCard title="Equipe Outbound" value={totalOutboundHC} color="bg-white text-blue-700 border-l-4 border-blue-500" icon={<ArrowUpCircle />} />
      </div>

      {/* --- TABELA DETALHADA --- */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span>Detalhamento</span>
            {viewMode !== 'Full' && (
              <span className="bg-dhl-yellow text-dhl-red text-xs px-2 py-0.5 rounded uppercase font-bold">
                Filtrado: {viewMode}º Turno ({shiftDist[`s${viewMode}` as keyof typeof shiftDist]}% do Vol)
              </span>
            )}
          </div>
          <button onClick={loadProcesses} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
            <RefreshCw size={18} />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3">Processo</th>
                <th className="px-6 py-3 text-center">Tipo</th>
                <th className="px-6 py-3 text-right">Meta</th>
                <th className="px-6 py-3 text-center w-28">% Vol. Proc.</th> 
                <th className="px-6 py-3 text-right">Volume</th>
                <th className="px-6 py-3 text-right">Horas</th>
                <th className="px-6 py-3 text-center font-bold text-gray-800 bg-gray-100">HC Final</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Carregando...</td></tr>
              ) : tableRows.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Nenhum processo cadastrado.</td></tr>
              ) : (
                tableRows.map((row) => (
                  <tr 
                    key={row.uniqueKey} 
                    className={`
                      border-b transition-colors
                      ${row.type === 'Process' ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100'}
                    `}
                  >
                    <td className="px-6 py-4">
                      {row.type === 'Process' ? (
                        <span className="font-bold text-gray-800 text-base">{row.name}</span>
                      ) : (
                        <div className="flex items-center gap-2 pl-6">
                          <CornerDownRight size={16} className="text-gray-400" />
                          <span className="font-medium text-gray-600">{row.name}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-center">
                      {row.type === 'Process' && (
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          row.operationType === 'Inbound' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {row.operationType}
                        </span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 text-right text-gray-600 font-mono">
                      {row.meta}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input 
                          type="number" min="0" max="999"
                          className={`w-12 p-1 text-center border rounded outline-none font-bold text-xs
                            ${row.type === 'Process' ? 'border-gray-300 text-gray-700 bg-white' : 'border-blue-300 text-blue-700 bg-blue-50/10'}
                          `}
                          value={row.splitPercentage}
                          onChange={(e) => handleSplitChange(row.uniqueKey, e.target.value)}
                        />
                        <Percent size={12} className="text-gray-400" />
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right font-medium text-gray-700">
                      {row.volumeCalculated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {row.hours.toFixed(2)}
                    </td>
                    
                    <td className={`px-6 py-4 text-center border-l border-gray-200 ${row.type === 'Process' ? 'bg-gray-100' : ''}`}>
                      <div className="flex items-center justify-center gap-2">
                        {row.hcFinal > 0 ? (
                           <>
                             <Users size={14} className={row.type === 'Process' ? "text-dhl-red" : "text-gray-400"} />
                             <span className={`text-lg ${row.type === 'Process' ? "font-black text-dhl-red" : "font-bold text-gray-600"}`}>
                               {row.hcFinal.toFixed(1)}
                             </span>
                           </>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && tableRows.length > 0 && (
              <tfoot className="bg-gray-100 font-bold text-gray-800 sticky bottom-0">
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-right uppercase text-xs tracking-wider">Total {viewMode === 'Full' ? 'Dia' : 'Turno'}:</td>
                  <td className="px-6 py-4 text-right text-dhl-red">{tableRows.reduce((a, b) => a + b.hours, 0).toFixed(1)} h</td>
                  <td className="px-6 py-4 text-center text-2xl text-dhl-red">{totalHC.toFixed(1)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ title, value, subtitle, color, icon }: any) {
  return (
    <div className={`p-6 rounded-lg shadow-sm flex items-center justify-between ${color}`}>
      <div>
        <p className="text-sm opacity-90 uppercase font-bold mb-1">{title}</p>
        <p className="text-4xl font-black">{value.toFixed(1)}</p>
        {subtitle && <p className="text-xs opacity-70 mt-1 font-medium">{subtitle}</p>}
      </div>
      <div className="opacity-20 transform scale-150">
        {icon}
      </div>
    </div>
  );
}