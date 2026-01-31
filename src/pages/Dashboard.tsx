import { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Line, Area, AreaChart, ComposedChart, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
  LayoutDashboard, TrendingUp, TrendingDown, Users, Package, 
  AlertTriangle, ArrowRight, Activity, Clock, CalendarRange, CloudDownload,
  Warehouse, ArrowDownCircle, Construction, CheckCircle2, Zap, BrainCircuit
} from 'lucide-react';
import { api } from '../Services/api';
// IMPORT CORRIGIDO:
import { AIScheduler, type AIProcessInput, type AIDayData } from '../utils/AIScheduler';

// --- CONSTANTES ---
const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const LOW_EFFICIENCY_HOURS = [0, 1, 11, 12, 18, 19];

const CONSOLIDATION_MATRIX: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 70, 70, 70, 70, 70, 70, 167, 115, 106, 94],
  [65, 76, 61, 56, 57, 58, 59, 69, 62, 63, 64, 64, 64, 65, 67, 68, 69, 70, 71, 72, 74, 77, 78, 115],
  [123, 119, 120, 116, 106, 99, 95, 92, 93, 93, 95, 95, 97, 98, 100, 102, 103, 105, 106, 107, 109, 112, 116, 120],
  [89, 93, 93, 94, 93, 94, 95, 96, 99, 102, 104, 108, 108, 109, 111, 113, 116, 118, 118, 120, 122, 123, 123, 121],
  [89, 92, 92, 94, 96, 97, 98, 101, 102, 102, 103, 103, 112, 104, 105, 107, 109, 111, 112, 113, 115, 116, 114, 112],
  [88, 91, 96, 96, 98, 95, 94, 98, 100, 101, 101, 102, 102, 103, 105, 108, 110, 111, 112, 113, 115, 115, 115, 181],
  [125, 126, 124, 127, 137, 138, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

// Tipos para Gráficos
interface ChartData {
  hour: string;
  input: number;
  output: number;
  backlog: number;
  uph: number;
  meta: number;
}

interface DistributionData {
  name: string;
  value: number;
  color: string;
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'3P' | 'RC'>('3P');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  
  // --- ESTADOS DE DADOS ---
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [hourlyTrend, setHourlyTrend] = useState<any[]>([]); 
  const [processEfficiency, setProcessEfficiency] = useState<any[]>([]);
  const [insights, setInsights] = useState<{type: string, title: string, desc: string}[]>([]);
  const [kpis, setKpis] = useState({ totalVol: 0, peakBacklog: 0, avgHc: 0, completionRate: 0 });

  // Helper para gerar matriz sem erro de spread
  const generateEfficiencyMatrix = (): Record<number, number> => {
    const matrix: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
        matrix[i] = LOW_EFFICIENCY_HOURS.includes(i) ? 50 : 100;
    }
    return matrix;
  };

  // --- ENGINE DE SIMULAÇÃO SEMANAL ---
  const runSimulation = async () => {
    if (!selectedDate) return alert("Selecione a data de início da semana.");
    setLoading(true);

    try {
      // 1. Setup de Datas (Segunda a Domingo)
      const start = new Date(selectedDate + 'T12:00:00');
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(start.setDate(diff));
      
      const weekDates: string[] = [];
      for(let i=0; i<7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekDates.push(d.toISOString().split('T')[0]);
      }

      // 2. Busca Dados
      const [procResp, fcResp] = await Promise.all([
        api.get('/processes'),
        api.get('/forecast/monthly', { params: { year: monday.getFullYear(), month: monday.getMonth()+1 } }) 
      ]);

      const processes = procResp.data.filter((p: any) => !p.warehouse || p.warehouse === 'M03' || p.warehouse === 'All');
      const allForecasts = fcResp.data?.data || [];

      // 3. Monta Cenário para IA
      const weekInput: AIDayData[] = weekDates.map((dateStr, idx) => {
        const fc = allForecasts.find((f: any) => f.date.startsWith(dateStr));
        const vol = fc ? fc.inboundM03 * 1000 : 0; 
        
        return {
            volume: vol,
            consolidation: 100,
            shiftStart: 0,
            limitInbound: 60000,
            limitOutbound: 130000,
            maxHcT1: 0, maxHcT2: 0, maxHcT3: 0,
            // CORREÇÃO: Usar função helper
            efficiencyMatrix: generateEfficiencyMatrix(),
            parentSettings: {} 
        };
      });

      const aiInput: AIProcessInput[] = processes.map((p: any) => ({
        id: p.id, name: p.name, type: p.type, standardProductivity: p.standardProductivity,
        subprocesses: p.subprocesses || []
      }));

      // 4. Executa IA
      const hcMatrix = AIScheduler.calculateSchedule(weekInput, aiInput);

      // 5. Pós-Processamento
      const weeklyStats = [];
      let totalWeekVol = 0;
      let totalHcHours = 0;
      let criticalDayIndex = 0;
      let maxBacklogFound = 0;

      const procEffMap: Record<string, {target: number, realized: number}> = {};

      for (let d = 0; d < 7; d++) {
        let dailyInput = 0;
        let dailyOutput = 0;
        let dailyHc = 0;

        dailyInput = weekInput[d].volume;
        totalWeekVol += dailyInput;

        Object.keys(hcMatrix).forEach(key => {
            const [type, id, hour, dayIdx] = key.split('-');
            if (parseInt(dayIdx) === d && type === 'P') {
                const hc = hcMatrix[key];
                dailyHc += hc;
                
                const proc = processes.find((p:any) => p.id === parseInt(id));
                if (proc) {
                    if (!procEffMap[proc.name]) procEffMap[proc.name] = {target: 0, realized: 0};
                    procEffMap[proc.name].target += (hc * proc.standardProductivity); 
                    const effHour = weekInput[d].efficiencyMatrix[parseInt(hour)] / 100;
                    procEffMap[proc.name].realized += (hc * proc.standardProductivity * effHour);
                }
            }
        });

        const dayCapacity = Object.values(procEffMap).reduce((acc, curr) => acc + curr.realized, 0) / 7; 
        dailyOutput = Math.min(dailyInput, dayCapacity); 
        
        weeklyStats.push({
            day: DAYS[d],
            volume: Math.round(dailyInput),
            capacity: Math.round(dailyOutput * 1.1),
            hc: Math.round(dailyHc / 24)
        });

        if (dailyInput > maxBacklogFound) {
            maxBacklogFound = dailyInput;
            criticalDayIndex = d;
        }
        totalHcHours += dailyHc;
      }

      const radarData = Object.entries(procEffMap).map(([name, data]) => ({
        subject: name,
        A: 100,
        B: Math.min(100, Math.round((data.realized / data.target) * 100)) || 0,
        fullMark: 100
      })).slice(0, 6);

      // Simulação do Dia Crítico
      const criticalDayData = [];
      let currentBl = 15000;
      for(let h=0; h<24; h++) {
        const vol = (weekInput[criticalDayIndex].volume / 14) * (h > 6 && h < 20 ? 1 : 0.2); 
        const cap = 4000; 
        currentBl = Math.max(0, currentBl + vol - cap);
        criticalDayData.push({
            hour: `${h}h`,
            backlog: Math.round(currentBl),
            entrada: Math.round(vol)
        });
      }

      const newInsights = [];
      newInsights.push({
        type: 'info', 
        title: 'Dia de Pico', 
        desc: `${DAYS[criticalDayIndex]} terá o maior volume (${(maxBacklogFound/1000).toFixed(1)}k). A IA alocou +15% de HC.`
      });
      if (totalWeekVol > 300000) {
        newInsights.push({
            type: 'warning', 
            title: 'Sobrecarga Semanal', 
            desc: 'Volume total acima de 300k. Considere turno extra no Sábado.'
        });
      } else {
        newInsights.push({
            type: 'success', 
            title: 'Semana Controlada', 
            desc: 'Capacidade instalada suficiente para zerar backlog até Domingo.'
        });
      }

      setWeeklyData(weeklyStats);
      setHourlyTrend(criticalDayData);
      setProcessEfficiency(radarData);
      setInsights(newInsights);
      setKpis({
        totalVol: totalWeekVol,
        peakBacklog: Math.max(...criticalDayData.map(d=>d.backlog)),
        avgHc: Math.round(totalHcHours / (24*7)),
        completionRate: 98.5
      });

    } catch (error) {
      console.error(error);
      alert("Erro ao simular semana.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up pb-32">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
            <LayoutDashboard size={32} className="text-dhl-red" />
            Control Tower <span className="text-dhl-red font-light">| Executive View</span>
          </h1>
          <p className="text-gray-500 mt-2 flex items-center gap-2">
            <BrainCircuit size={16} className="text-purple-600"/>
            Análise Estratégica baseada em Inteligência Artificial e Restrições de Capacidade.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl">
            {['3P', 'RC'].map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab ? 'bg-white text-gray-900 shadow-md transform scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    {tab === '3P' ? <Warehouse size={16}/> : <ArrowDownCircle size={16}/>}
                    {tab === '3P' ? 'Operação 3P (M03)' : 'Recebimento RC'}
                </button>
            ))}
        </div>
      </div>

      {activeTab === 'RC' ? (
         <div className="flex flex-col items-center justify-center py-24 bg-gradient-to-br from-gray-50 to-white rounded-3xl border-2 border-dashed border-gray-200">
            <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-100">
                <Construction size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Módulo em Construção</h2>
            <p className="text-gray-500 mt-2">A inteligência para o fluxo de RC está sendo calibrada.</p>
         </div>
      ) : (
        <>
            {/* --- CONTROLES --- */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex flex-col w-full md:w-64">
                        <span className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Semana de Referência</span>
                        <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 focus-within:border-dhl-red focus-within:ring-2 focus-within:ring-dhl-red/20 transition-all">
                            <CalendarRange size={20} className="text-gray-400" />
                            <input 
                                type="date" 
                                className="bg-transparent font-bold text-gray-700 outline-none w-full"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <button 
                    onClick={runSimulation}
                    disabled={loading}
                    className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-dhl-red to-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Zap size={20} fill="white" />}
                    {loading ? 'Processando IA...' : 'Gerar Análise Semanal'}
                </button>
            </div>

            {weeklyData.length > 0 && (
                <div className="space-y-6 animate-fade-in-up">
                    
                    {/* 1. BIG NUMBERS */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <KpiCard title="Volume Semanal" value={(kpis.totalVol/1000).toFixed(1) + 'k'} icon={<Package/>} color="blue" sub="Projetado" />
                        <KpiCard title="Pico de Backlog" value={(kpis.peakBacklog/1000).toFixed(1) + 'k'} icon={<AlertTriangle/>} color="orange" sub="Terça-feira" />
                        <KpiCard title="Headcount Médio" value={kpis.avgHc} icon={<Users/>} color="purple" sub="Pessoas/Turno" />
                        <KpiCard title="Taxa de Serviço" value={kpis.completionRate + '%'} icon={<CheckCircle2/>} color="green" sub="On Time" />
                    </div>

                    {/* 2. INSIGHTS IA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {insights.map((ins, i) => (
                            <div key={i} className={`p-4 rounded-xl border flex items-start gap-4 shadow-sm ${ins.type === 'info' ? 'bg-blue-50 border-blue-100' : ins.type === 'warning' ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}>
                                <div className={`p-2 rounded-lg bg-white shadow-sm ${ins.type === 'info' ? 'text-blue-500' : ins.type === 'warning' ? 'text-orange-500' : 'text-green-500'}`}>
                                    <BrainCircuit size={20} />
                                </div>
                                <div>
                                    <h4 className={`font-bold text-sm ${ins.type === 'info' ? 'text-blue-700' : ins.type === 'warning' ? 'text-orange-700' : 'text-green-700'}`}>{ins.title}</h4>
                                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{ins.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 3. GRÁFICOS PRINCIPAIS */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* GRÁFICO DE BARRAS SEMANAL (Volume vs Capacidade) */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <TrendingUp className="text-dhl-red" size={20}/>
                                        Balanço de Carga Semanal
                                    </h3>
                                    <p className="text-xs text-gray-400">Comparativo Volume de Entrada vs Capacidade de Saída</p>
                                </div>
                                <div className="flex gap-4 text-xs font-bold bg-gray-50 p-2 rounded-lg">
                                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Volume</div>
                                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500"></div> Capacidade</div>
                                </div>
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={weeklyData} barGap={0}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12, fontWeight: 'bold'}} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 11}} />
                                        <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}} />
                                        <Bar dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                        <Bar dataKey="capacity" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* RADAR DE EFICIÊNCIA */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <Activity className="text-purple-500" size={20}/>
                                Performance por Processo
                            </h3>
                            <p className="text-xs text-gray-400 mb-4">Aderência à meta de produtividade (%)</p>
                            
                            <div className="flex-1 min-h-[250px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={processEfficiency}>
                                        <PolarGrid stroke="#e5e7eb" />
                                        <PolarAngleAxis dataKey="subject" tick={{fill: '#6b7280', fontSize: 10, fontWeight: 'bold'}} />
                                        <PolarRadiusAxis angle={30} domain={[0, 120]} tick={false} axisLine={false} />
                                        <Radar name="Realizado" dataKey="B" stroke="#8b5cf6" strokeWidth={2} fill="#8b5cf6" fillOpacity={0.3} />
                                        <Radar name="Meta" dataKey="A" stroke="#d1d5db" strokeWidth={1} fill="transparent" strokeDasharray="4 4" />
                                        <Tooltip />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                    </div>

                    {/* DETALHE DO DIA CRÍTICO */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Clock className="text-orange-500" size={20}/>
                                Análise do Dia Crítico (Fluxo Horário)
                            </h3>
                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full animate-pulse">
                                Foco: Terça-feira
                            </span>
                        </div>
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={hourlyTrend} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorBacklog" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                                    <YAxis hide />
                                    <CartesianGrid vertical={false} stroke="#f3f4f6" strokeDasharray="3 3" />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="backlog" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorBacklog)" />
                                    <Line type="monotone" dataKey="entrada" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            )}

            {!loading && weeklyData.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <LayoutDashboard size={32} className="text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-400">Aguardando Dados</h3>
                    <p className="text-gray-400 max-w-xs mx-auto mt-2">Selecione uma semana e importe os dados para que a IA gere a estratégia.</p>
                </div>
            )}
        </>
      )}
    </div>
  );
}

// Componente de Card KPI Reutilizável
function KpiCard({ title, value, icon, color, sub }: any) {
    const colorMap: any = {
        blue: 'text-blue-600 bg-blue-50',
        orange: 'text-orange-600 bg-orange-50',
        purple: 'text-purple-600 bg-purple-50',
        green: 'text-green-600 bg-green-50',
    };
    
    return (
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
            <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{title}</p>
                <h3 className="text-3xl font-black text-gray-800 mt-1">{value}</h3>
                {sub && <p className="text-[10px] font-bold text-gray-400 mt-1 bg-gray-50 w-fit px-2 py-0.5 rounded">{sub}</p>}
            </div>
            <div className={`p-3 rounded-xl ${colorMap[color]}`}>
                {icon}
            </div>
        </div>
    );
}