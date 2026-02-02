import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Line, Area, AreaChart, ComposedChart, Radar, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
  LayoutDashboard, TrendingUp, Users, Package, 
  AlertTriangle, Clock, CalendarRange, CheckCircle2, Zap, BrainCircuit, Activity, Info, Warehouse
} from 'lucide-react';
import { api } from '../Services/api';

// --- CONSTANTES & MATRIZES (M03) ---
const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const LOW_EFFICIENCY_HOURS = [0, 1, 11, 12, 18, 19];

const RECEIVING_SHARE_MATRIX: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 9, 9, 7, 14, 20, 20, 9], 
  [4, 3, 5, 4, 5, 4, 4, 4, 5, 8, 6, 3, 1, 5, 4, 3, 6, 5, 5, 3, 3, 3, 6, 4], 
  [5, 3, 3, 5, 5, 5, 4, 5, 5, 3, 5, 3, 3, 5, 5, 5, 4, 4, 2, 3, 4, 4, 3, 3], 
  [5, 2, 2, 5, 5, 4, 4, 4, 5, 5, 5, 5, 2, 2, 5, 7, 6, 5, 4, 2, 3, 5, 5, 4], 
  [5, 2, 2, 5, 5, 4, 4, 4, 5, 5, 5, 5, 2, 2, 5, 7, 6, 5, 4, 2, 3, 5, 5, 4], 
  [4, 2, 2, 4, 4, 3, 3, 4, 5, 5, 6, 3, 3, 6, 7, 5, 6, 4, 3, 4, 3, 6, 6, 2], 
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]  
];

const CONSOLIDATION_MATRIX: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 70, 70, 70, 70, 70, 70, 167, 115, 106, 94],
  [65, 76, 61, 56, 57, 58, 59, 69, 62, 63, 64, 64, 64, 65, 67, 68, 69, 70, 71, 72, 74, 77, 78, 115],
  [123, 119, 120, 116, 106, 99, 95, 92, 93, 93, 95, 95, 97, 98, 100, 102, 103, 105, 106, 107, 109, 112, 116, 120],
  [89, 93, 93, 94, 93, 94, 95, 96, 99, 102, 104, 108, 108, 109, 111, 113, 116, 118, 118, 120, 122, 123, 123, 121],
  [89, 92, 92, 94, 96, 97, 98, 101, 102, 102, 103, 103, 112, 104, 105, 107, 109, 111, 112, 113, 115, 116, 114, 112],
  [88, 91, 96, 96, 98, 95, 94, 98, 100, 101, 101, 102, 102, 103, 105, 108, 110, 111, 112, 113, 115, 115, 115, 181],
  [125, 126, 124, 127, 137, 138, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

export function Dashboard() {
  // Removido o estado activeTab pois agora esta pagina é exclusiva do M03
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  
  // --- ESTADOS DE DADOS ---
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [hourlyTrend, setHourlyTrend] = useState<any[]>([]); 
  const [processEfficiency, setProcessEfficiency] = useState<any[]>([]);
  const [insights, setInsights] = useState<{type: string, title: string, desc: string}[]>([]);
  const [kpis, setKpis] = useState({ totalVol: 0, peakBacklog: 0, avgHc: 0, slaAdherence: 0 });

  useEffect(() => {
    const today = new Date();
    handleDateSelection(today.toISOString().split('T')[0]);
  }, []);

  const handleDateSelection = (dateVal: string) => {
    if(!dateVal) return;
    const date = new Date(dateVal + 'T12:00:00'); 
    const day = date.getDay(); 
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
    
    const monday = new Date(date);
    monday.setDate(diff);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    setStartDate(monday.toISOString().split('T')[0]);
    setEndDate(sunday.toISOString().split('T')[0]);
  };

  const generateEfficiencyMatrix = (): Record<number, number> => {
    const matrix: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
        matrix[i] = LOW_EFFICIENCY_HOURS.includes(i) ? 50 : 100;
    }
    return matrix;
  };

  const runSimulation = async () => {
    if (!startDate) return;
    setLoading(true);

    try {
      const start = new Date(startDate + 'T12:00:00');
      const weekDates: string[] = [];
      for(let i=0; i<7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        weekDates.push(d.toISOString().split('T')[0]);
      }

      // 1. Busca Dados Básicos
      const [procResp, fcResp] = await Promise.all([
        api.get('/processes'),
        api.get('/forecast/monthly', { params: { year: start.getFullYear(), month: start.getMonth()+1 } }) 
      ]);

      let processes = procResp.data.filter((p: any) => !p.warehouse || p.warehouse === 'M03' || p.warehouse === 'All');
      const allForecasts = fcResp.data?.data || [];

      // Ordena processos
      processes.sort((a:any, b:any) => {
          const getRank = (name: string) => {
              const n = name.toLowerCase();
              if (n.includes('recebimento')) return 1;
              if (n.includes('put') || n.includes('armazenagem')) return 2;
              if (n.includes('picking') || n.includes('separação')) return 3;
              if (n.includes('sort')) return 4;
              if (n.includes('pack') || n.includes('embalagem')) return 5;
              return 99;
          };
          return getRank(a.name) - getRank(b.name);
      });

      // 2. Monta Payload
      const weekInput = weekDates.map((dateStr) => {
        const fc = allForecasts.find((f: any) => f.date.startsWith(dateStr));
        const vol = fc ? fc.inboundM03 * 1000 : 0; 
        
        return {
            volume: vol,
            consolidation: 100,
            shiftStart: 0,
            limitInbound: 60000,
            limitOutbound: 130000,
            maxHcT1: 100,
            maxHcT2: 100,
            maxHcT3: 60,
            efficiencyMatrix: generateEfficiencyMatrix(),
            parentSettings: {} 
        };
      });

      const aiInput = processes.map((p: any) => ({
        id: p.id, 
        name: p.name, 
        type: p.type, 
        standardProductivity: p.standardProductivity,
        efficiency: p.efficiency, 
        travelTime: p.travelTime, 
        subprocesses: p.subprocesses ? p.subprocesses.map((s:any) => ({
            id: s.id, 
            standardProductivity: s.standardProductivity
        })) : []
      }));

      // 3. CHAMA O BACKEND
      const response = await api.post('/simulation/smart-distribute', {
          weekData: weekInput,
          processes: aiInput
      });

      const hcMatrix = response.data; 

      // 4. PÓS-PROCESSAMENTO DO FLUXO
      const weeklyStats: { day: string; volume: number; capacity: number; backlog: number; hc: number }[] = [];
      const criticalDayData: { hour: string; backlog: number; entrada: number; saida: number }[] = [];

      let totalWeekVol = 0;
      let totalHcHours = 0;
      let maxBacklogFound = 0;
      let totalSlaBreach = 0;
      
      const outputsByProcess: Record<number, number[][]> = {};
      processes.forEach((p:any) => {
          outputsByProcess[p.id] = Array.from({length: 7}, () => Array(24).fill(0));
      });

      const runningBacklogs: Record<number, number> = {};
      processes.forEach((p:any) => runningBacklogs[p.id] = 0);

      const procEffMap: Record<string, {target: number, realized: number}> = {};

      // Loop Dia a Dia
      for (let d = 0; d < 7; d++) {
        let dailyInput = weekInput[d].volume;
        totalWeekVol += dailyInput;
        let dailyHc = 0;
        let dailyOutput = 0;
        let dailyBacklog = 0;

        // Loop Hora a Hora
        for(let h=0; h<24; h++) {
            
            processes.forEach((proc:any, pIdx:number) => {
                const procName = proc.name.toLowerCase();
                const isPicking = procName.includes('picking') || procName.includes('separação');
                
                // 1. INPUT
                let input = 0;
                if (pIdx === 0 && proc.type === 'Inbound') {
                    const share = RECEIVING_SHARE_MATRIX[d][h];
                    input = dailyInput * (share / 100);
                } else if (pIdx > 0) {
                    const prevProc = processes[pIdx - 1];
                    const prevOutput = outputsByProcess[prevProc.id][d][h];
                    
                    if (isPicking) {
                        const consol = CONSOLIDATION_MATRIX[d][h] / 100;
                        input = prevOutput * consol;
                    } else {
                        input = prevOutput;
                    }
                }

                // 2. HC
                const hc = hcMatrix[`P-${proc.id}-${h}-${d}`] || 0;
                dailyHc += hc;

                // 3. OUTPUT
                const effFactor = (weekInput[d].efficiencyMatrix[h] ?? 100) / 100;
                const netTime = Math.max(0.1, (60 - (proc.travelTime || 0)) / 60);
                const capacity = hc * proc.standardProductivity * (proc.efficiency || 1) * netTime * effFactor;

                const currentBacklog = runningBacklogs[proc.id];
                const totalLoad = input + currentBacklog;
                const output = Math.min(totalLoad, capacity);
                
                outputsByProcess[proc.id][d][h] = output;
                runningBacklogs[proc.id] = Math.max(0, totalLoad - output);

                if (proc.type === 'Outbound') dailyOutput += output;
                
                // Popula o array do dia crítico (Terça-feira, index 1)
                if (d === 1 && proc.type === 'Outbound') { 
                    criticalDayData.push({
                        hour: `${h}h`,
                        backlog: Math.round(runningBacklogs[proc.id]),
                        entrada: Math.round(input),
                        saida: Math.round(output)
                    });
                }

                if (proc) {
                    if (!procEffMap[proc.name]) procEffMap[proc.name] = {target: 0, realized: 0};
                    procEffMap[proc.name].target += (hc * proc.standardProductivity); 
                    procEffMap[proc.name].realized += capacity;
                }
            });
        }

        dailyBacklog = Object.values(runningBacklogs).reduce((a, b) => a + b, 0);
        
        weeklyStats.push({
            day: DAYS[d],
            volume: Math.round(dailyInput),
            capacity: Math.round(dailyOutput),
            backlog: Math.round(dailyBacklog),
            hc: Math.round(dailyHc / 24)
        });

        if (dailyBacklog > maxBacklogFound) maxBacklogFound = dailyBacklog;
        if (dailyBacklog > 20000) totalSlaBreach++; 
        totalHcHours += dailyHc;
      }

      // --- GERANDO INSIGHTS ---
      const newInsights = [];
      
      if (maxBacklogFound > 30000) {
        newInsights.push({ type: 'warning', title: 'Risco Crítico de SLA', desc: `Pico de backlog de ${(maxBacklogFound/1000).toFixed(1)}k unidades detectado. Considere aumentar T3.` });
      } else if (maxBacklogFound > 10000) {
        newInsights.push({ type: 'info', title: 'Atenção Operacional', desc: 'Backlog controlado, mas próximo do limite de conforto. Monitore a Terça-feira.' });
      } else {
        newInsights.push({ type: 'success', title: 'Operação Saudável', desc: 'Backlog sob controle total. Capacidade sobra para absorver imprevistos.' });
      }
      
      const totalTarget = Object.values(procEffMap).reduce((a, b) => a + b.target, 0);
      const totalRealized = Object.values(procEffMap).reduce((a, b) => a + b.realized, 0);
      const globalEff = totalTarget > 0 ? (totalRealized / totalTarget) * 100 : 0;

      if (globalEff < 80) {
        newInsights.push({ type: 'warning', title: 'Perda de Eficiência', desc: `Perda de ${(100-globalEff).toFixed(0)}% por deslocamento e fadiga. Otimize rotas de Picking.` });
      } else {
        newInsights.push({ type: 'success', title: 'Alta Produtividade', desc: 'O time está operando próximo da capacidade máxima teórica.' });
      }

      const radarData = Object.entries(procEffMap).map(([name, data]) => ({
        subject: name,
        A: 100, 
        B: Math.min(120, Math.round((data.realized / data.target) * 100)) || 0,
        fullMark: 100
      })).slice(0, 6);

      setWeeklyData(weeklyStats);
      setHourlyTrend(criticalDayData);
      setProcessEfficiency(radarData);
      setInsights(newInsights);
      setKpis({
        totalVol: totalWeekVol,
        peakBacklog: maxBacklogFound,
        avgHc: Math.round(totalHcHours / (24*7)),
        slaAdherence: Math.round(100 - (totalSlaBreach/7 * 100))
      });

    } catch (error) {
      console.error(error);
      alert("Erro ao simular semana.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
    `}</style>

    <div className="space-y-8 animate-fade-in-up pb-32">
      
      {/* --- HEADER --- */}
      <div className="bg-white rounded-3xl p-1 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-dhl-yellow/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="bg-white rounded-2xl p-6 relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                <LayoutDashboard size={32} className="text-dhl-red" />
                Control Tower <span className="text-dhl-red font-light">| Operação 3P (M03)</span>
              </h1>
              <p className="text-gray-500 mt-2 flex items-center gap-2">
                <BrainCircuit size={16} className="text-purple-600"/>
                Simulação baseada em IA (ML.NET) com restrições de Eficiência.
              </p>
            </div>
        </div>
      </div>

      {/* --- CONTROLES --- */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-4 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200">
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">De (Segunda)</span>
                      <div className="flex items-center gap-2">
                          <CalendarRange size={16} className="text-gray-400" />
                          <input 
                              type="date" 
                              className="bg-transparent font-bold text-gray-700 outline-none text-sm"
                              value={startDate}
                              onChange={e => handleDateSelection(e.target.value)}
                          />
                      </div>
                  </div>
                  <div className="h-8 w-px bg-gray-300"></div>
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Até (Domingo)</span>
                      <div className="flex items-center gap-2">
                          <input 
                              type="date" 
                              className="bg-transparent font-bold text-gray-500 outline-none text-sm cursor-not-allowed"
                              value={endDate}
                              disabled
                          />
                      </div>
                  </div>
              </div>
          </div>
          <button 
              onClick={runSimulation}
              disabled={loading}
              className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-dhl-red to-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
              {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Zap size={20} fill="white" />}
              {loading ? 'Simulando com ML.NET...' : 'Atualizar Dashboard'}
          </button>
      </div>

      {weeklyData.length > 0 && (
          <div className="space-y-6 animate-fade-in-up">
              
              {/* 1. KPI CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KpiCard title="Volume Projetado" value={(kpis.totalVol/1000).toFixed(1) + 'k'} icon={<Package/>} color="blue" sub="Unidades Semana" />
                  <KpiCard title="Pico de Backlog" value={(kpis.peakBacklog/1000).toFixed(1) + 'k'} icon={<AlertTriangle/>} color="orange" sub="Risco Operacional" />
                  <KpiCard title="HC Médio / Turno" value={kpis.avgHc} icon={<Users/>} color="purple" sub="Recursos Necessários" />
                  <KpiCard title="Aderência SLA" value={kpis.slaAdherence + '%'} icon={<CheckCircle2/>} color={kpis.slaAdherence > 95 ? 'green' : 'red'} sub="Meta: >98%" />
              </div>

              {/* 2. INSIGHTS IA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.map((ins, i) => (
                      <div key={i} className={`p-4 rounded-xl border-l-4 flex items-start gap-4 shadow-sm bg-white ${ins.type === 'info' ? 'border-l-blue-500' : ins.type === 'warning' ? 'border-l-orange-500' : 'border-l-green-500'}`}>
                          <div className={`p-2 rounded-lg bg-gray-50 ${ins.type === 'info' ? 'text-blue-500' : ins.type === 'warning' ? 'text-orange-500' : 'text-green-500'}`}>
                              <BrainCircuit size={20} />
                          </div>
                          <div>
                              <h4 className="font-bold text-sm text-gray-800">{ins.title}</h4>
                              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{ins.desc}</p>
                          </div>
                      </div>
                  ))}
              </div>

              {/* 3. GRÁFICOS PRINCIPAIS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* VOLUME vs CAPACIDADE (Composed Chart) */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                          <div>
                              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                  <TrendingUp className="text-dhl-red" size={20}/>
                                  Planejamento Semanal
                              </h3>
                              <p className="text-xs text-gray-400">Entrada vs Saída vs Acúmulo</p>
                          </div>
                          <div className="flex gap-4 text-xs font-bold bg-gray-50 p-2 rounded-lg">
                              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500"></div> Volume</div>
                              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500"></div> Capacidade</div>
                              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-400"></div> Backlog</div>
                          </div>
                      </div>
                      <div className="h-[320px]">
                          <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={weeklyData}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12, fontWeight: 'bold'}} dy={10} />
                                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 11}} />
                                  <YAxis yAxisId="right" orientation="right" hide />
                                  <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}} />
                                  <Bar yAxisId="left" dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                  <Bar yAxisId="left" dataKey="capacity" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
                                  <Area yAxisId="right" type="monotone" dataKey="backlog" fill="#fb923c" stroke="#f97316" fillOpacity={0.2} />
                              </ComposedChart>
                          </ResponsiveContainer>
                      </div>
                  </div>

                  {/* RADAR DE EFICIÊNCIA */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                      <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <Activity className="text-purple-500" size={20}/>
                          Eficiência Operacional
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">Meta vs Realizado (Impacto de Deslocamento)</p>
                      
                      <div className="flex-1 min-h-[250px] relative">
                          <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={processEfficiency}>
                                  <PolarGrid stroke="#e5e7eb" />
                                  <PolarAngleAxis dataKey="subject" tick={{fill: '#6b7280', fontSize: 10, fontWeight: 'bold'}} />
                                  <PolarRadiusAxis angle={30} domain={[0, 120]} tick={false} axisLine={false} />
                                  <Radar name="Real" dataKey="B" stroke="#8b5cf6" strokeWidth={2} fill="#8b5cf6" fillOpacity={0.3} />
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
                          Comportamento no Pico (Simulação Horária)
                      </h3>
                      <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full animate-pulse border border-orange-100">
                          Análise de Gargalo
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
                                  <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                              <YAxis hide />
                              <CartesianGrid vertical={false} stroke="#f3f4f6" strokeDasharray="3 3" />
                              <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                              <Area type="monotone" dataKey="backlog" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorBacklog)" name="Acúmulo" />
                              <Area type="monotone" dataKey="entrada" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorEntrada)" name="Entrada" />
                              <Line type="monotone" dataKey="saida" stroke="#22c55e" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Capacidade" />
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </div>

          </div>
      )}

      {!loading && weeklyData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 animate-bounce">
                  <LayoutDashboard size={40} className="text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Pronto para Simular</h3>
              <p className="text-gray-500 max-w-sm mx-auto mt-2">Selecione uma semana e clique em "Gerar Análise" para ver as projeções da Inteligência Artificial.</p>
          </div>
      )}
    </div>
    </>
  );
}

// Componente de Card KPI
function KpiCard({ title, value, icon, color, sub }: any) {
    const colorMap: any = {
        blue: 'text-blue-600 bg-blue-50 border-blue-100',
        orange: 'text-orange-600 bg-orange-50 border-orange-100',
        purple: 'text-purple-600 bg-purple-50 border-purple-100',
        green: 'text-green-600 bg-green-50 border-green-100',
        red: 'text-red-600 bg-red-50 border-red-100',
    };
    
    return (
        <div className={`bg-white p-5 rounded-2xl border-b-4 shadow-sm flex items-start justify-between hover:shadow-md transition-all group ${colorMap[color].replace('bg-', 'border-b-')}`}>
            <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide group-hover:text-gray-600 transition-colors">{title}</p>
                <h3 className="text-3xl font-black text-gray-800 mt-1">{value}</h3>
                {sub && <div className="flex items-center gap-1 mt-2"><Info size={12} className="text-gray-300"/><p className="text-[10px] font-bold text-gray-400">{sub}</p></div>}
            </div>
            <div className={`p-3 rounded-xl ${colorMap[color]}`}>
                {icon}
            </div>
        </div>
    );
}