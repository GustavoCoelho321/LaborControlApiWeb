import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Line, Area, AreaChart, ComposedChart, Radar, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
  LayoutDashboard, TrendingUp, Users, Package, 
  AlertTriangle, Clock, CalendarRange, ArrowDownCircle, 
  CheckCircle2, Zap, BrainCircuit, Activity, Info, Truck, ArrowUpCircle
} from 'lucide-react';
import { api } from '../Services/api';

// --- CONSTANTES ---
const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const LOW_EFFICIENCY_HOURS = [0, 1, 11, 12, 18, 19];

// Matriz de Chegada Específica do RC
const DOCK_ARRIVAL_MATRIX: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.10, 5.10, 8.60, 6.80, 4.70, 7.50, 10.30, 15.50, 9.80, 11.50, 13.00], 
  [5.10, 3.80, 2.30, 2.90, 4.50, 3.30, 2.10, 4.50, 3.90, 3.70, 2.90, 2.20, 2.20, 2.30, 4.00, 3.40, 6.70, 4.60, 3.80, 5.00, 7.60, 4.20, 5.30, 5.50], 
  [5.90, 4.80, 3.50, 4.40, 4.90, 3.30, 2.50, 4.90, 3.40, 3.60, 3.20, 2.30, 2.20, 2.60, 4.10, 3.90, 6.20, 3.30, 3.40, 4.60, 7.20, 4.10, 5.00, 6.50], 
  [5.50, 3.30, 4.00, 4.50, 4.90, 2.90, 2.90, 4.10, 4.10, 3.80, 3.00, 2.20, 2.30, 2.60, 3.30, 4.50, 4.80, 2.60, 2.50, 5.70, 7.70, 5.90, 6.10, 6.80], 
  [7.10, 4.00, 3.00, 4.30, 4.60, 3.00, 2.40, 3.90, 3.20, 2.30, 2.20, 1.20, 0.80, 1.30, 3.50, 3.20, 5.70, 2.60, 3.10, 6.20, 9.30, 6.30, 6.90, 9.70], 
  [10.00, 7.50, 6.60, 8.20, 8.60, 5.30, 2.70, 6.90, 7.10, 3.90, 3.60, 2.50, 1.10, 1.20, 3.00, 3.80, 6.40, 5.90, 3.20, 1.60, 0.70, 0, 0, 0], 
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]  
];

export function DashboardRC() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  
  // --- ESTADOS DE DADOS ---
  const [weeklyData, setWeeklyData] = useState<{ day: string; volume: number; capacity: number; backlog: number; hc: number }[]>([]);
  const [hourlyTrend, setHourlyTrend] = useState<{ hour: string; backlog: number; entrada: number; saida: number }[]>([]); 
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
    const monday = new Date(date); monday.setDate(diff);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    setStartDate(monday.toISOString().split('T')[0]);
    setEndDate(sunday.toISOString().split('T')[0]);
  };

  const generateEfficiencyMatrix = (): Record<number, number> => {
    const matrix: Record<number, number> = {};
    for (let i = 0; i < 24; i++) matrix[i] = LOW_EFFICIENCY_HOURS.includes(i) ? 50 : 100;
    return matrix;
  };

  const runSimulation = async () => {
    if (!startDate) return;
    setLoading(true);

    try {
      const start = new Date(startDate + 'T12:00:00');
      const weekDates: string[] = [];
      for(let i=0; i<7; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        weekDates.push(d.toISOString().split('T')[0]);
      }

      // 1. Busca Dados
      const [procResp, fcResp] = await Promise.all([
        api.get('/processes'),
        api.get('/forecast/monthly', { params: { year: start.getFullYear(), month: start.getMonth()+1 } }) 
      ]);

      let processes = procResp.data.filter((p: any) => 
          (!p.warehouse || p.warehouse === 'RC' || p.warehouse === 'All') &&
          (p.name.toLowerCase().includes('handover') || p.name.toLowerCase().includes('sort') || p.name.toLowerCase().includes('consol') || p.name.toLowerCase().includes('over') || p.name.toLowerCase().includes('box') || p.name.toLowerCase().includes('label') || p.name.toLowerCase().includes('shipping'))
      );
      
      const allForecasts = fcResp.data?.data || [];

      // Ordena Fluxo RC
      processes.sort((a:any, b:any) => {
          const getRank = (name: string) => {
              const n = name.toLowerCase();
              if (n.includes('handover')) return 1;
              if (n.includes('sorter auto')) return 2;
              if (n.includes('sorter manual')) return 3;
              if (n.includes('consolidador')) return 4;
              if (n.includes('oversized')) return 5;
              if (n.includes('boxing')) return 6;
              if (n.includes('label a')) return 7;
              if (n.includes('label b')) return 8;
              return 99;
          };
          return getRank(a.name) - getRank(b.name);
      });

      // 2. Monta Payload
      const weekInput = weekDates.map((dateStr) => {
        const fc = allForecasts.find((f: any) => f.date.startsWith(dateStr));
        const vol = fc ? fc.rcRecebimento * 1000 : 0; 
        return {
            volume: vol, consolidation: 100, shiftStart: 0,
            limitInbound: 60000, limitOutbound: 130000,
            maxHcT1: 100, maxHcT2: 100, maxHcT3: 60,
            efficiencyMatrix: generateEfficiencyMatrix(), parentSettings: {} 
        };
      });

      const aiInput = processes.map((p: any) => ({
        id: p.id, name: p.name, type: p.type, standardProductivity: p.standardProductivity, efficiency: p.efficiency, travelTime: p.travelTime, 
        subprocesses: p.subprocesses ? p.subprocesses.map((s:any) => ({ id: s.id, standardProductivity: s.standardProductivity })) : []
      }));

      // 3. CHAMA O BACKEND RC
      const response = await api.post('/simulation/smart-distribute-rc', {
          weekData: weekInput,
          processes: aiInput
      });

      const hcMatrix = response.data; 

      // 4. PÓS-PROCESSAMENTO VISUAL (SIMULAÇÃO FRONTEND)
      const weeklyStats: any[] = [];
      const criticalDayData: any[] = [];
      let totalWeekVol = 0;
      let totalHcHours = 0;
      let maxBacklogFound = 0;
      let totalSlaBreach = 0;
      
      const outputsByProcess: Record<number, number[][]> = {};
      processes.forEach((p:any) => outputsByProcess[p.id] = Array.from({length: 7}, () => Array(24).fill(0)));

      const runningBacklogs: Record<number, number> = {};
      processes.forEach((p:any) => runningBacklogs[p.id] = 0);

      const procEffMap: Record<string, {target: number, realized: number}> = {};
      
      // Identificar IDs para fluxo
      const pIds: Record<string, number> = {};
      processes.forEach((p:any) => {
          const n = p.name.toLowerCase();
          if (n.includes('handover')) pIds['handover'] = p.id;
          else if (n.includes('auto')) pIds['sorter_auto'] = p.id;
          else if (n.includes('manual')) pIds['sorter_manual'] = p.id;
          else if (n.includes('consol')) pIds['consolidador'] = p.id;
          else if (n.includes('over')) pIds['oversized'] = p.id;
          else if (n.includes('box')) pIds['boxing'] = p.id;
          else if (n.includes('label a')) pIds['label_a'] = p.id;
          else if (n.includes('label b')) pIds['label_b'] = p.id;
      });

      // Loop Simulação
      for (let d = 0; d < 7; d++) {
        let dailyInput = weekInput[d].volume;
        totalWeekVol += dailyInput;
        let dailyHc = 0;
        let dailyOutput = 0;
        let dailyBacklog = 0;

        for(let h=0; h<24; h++) {
            processes.forEach((proc:any, pIdx:number) => {
                // INPUT FLUXO RC
                let input = 0;
                const is = (key: string) => pIds[key] === proc.id;
                const getOut = (key: string) => (pIds[key] && outputsByProcess[pIds[key]]) ? outputsByProcess[pIds[key]][d][h] : 0;

                if (is('handover')) {
                    const share = DOCK_ARRIVAL_MATRIX[d][h];
                    input = dailyInput * (share / 100);
                } 
                else if (is('sorter_auto')) input = getOut('handover') * 0.94;
                else if (is('sorter_manual')) input = getOut('handover') * 0.04;
                else if (is('consolidador')) input = getOut('handover') * 0.01;
                else if (is('oversized')) input = getOut('handover') * 0.01;
                else if (is('boxing')) input = getOut('sorter_auto') + getOut('sorter_manual') + getOut('consolidador') + getOut('oversized');
                else if (is('label_a')) input = getOut('boxing') * 0.88;
                else if (is('label_b')) input = getOut('boxing') * 0.12;

                const hc = hcMatrix[`P-${proc.id}-${h}-${d}`] || 0;
                dailyHc += hc;

                const effFactor = (weekInput[d].efficiencyMatrix[h] ?? 100) / 100;
                const netTime = Math.max(0.1, (60 - (proc.travelTime || 0)) / 60);
                const capacity = hc * proc.standardProductivity * (proc.efficiency || 1) * netTime * effFactor;

                const currentBacklog = runningBacklogs[proc.id];
                const totalLoad = input + currentBacklog;
                const output = Math.min(totalLoad, capacity);
                
                outputsByProcess[proc.id][d][h] = output;
                runningBacklogs[proc.id] = Math.max(0, totalLoad - output);

                // Considera Output Final apenas Labels A e B
                if (is('label_a') || is('label_b')) dailyOutput += output;

                // Captura hora a hora do Handover (Terça)
                if (d === 1 && is('handover')) { 
                    criticalDayData.push({
                        hour: `${h}h`,
                        backlog: Math.round(runningBacklogs[proc.id]), // Backlog no cais
                        entrada: Math.round(input), // Chegada Caminhões
                        saida: Math.round(output) // Processado
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
        if (dailyBacklog > 50000) totalSlaBreach++; 
        totalHcHours += dailyHc;
      }

      // INSIGHTS RC
      const newInsights = [];
      if (maxBacklogFound > 50000) newInsights.push({ type: 'warning', title: 'Congestionamento de Docas', desc: `Acúmulo de ${(maxBacklogFound/1000).toFixed(1)}k detectado. Reforce o Handover.` });
      else newInsights.push({ type: 'success', title: 'Fluxo Fluido', desc: 'Capacidade alinhada com as janelas de chegada.' });
      
      const totalTarget = Object.values(procEffMap).reduce((a, b) => a + b.target, 0);
      const totalRealized = Object.values(procEffMap).reduce((a, b) => a + b.realized, 0);
      const globalEff = totalTarget > 0 ? (totalRealized / totalTarget) * 100 : 0;

      if (globalEff < 85) newInsights.push({ type: 'info', title: 'Oportunidade', desc: `Eficiência geral de ${globalEff.toFixed(0)}%. Verifique o Sorter Automático.` });

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
      alert("Erro ao simular RC.");
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
      
      {/* HEADER AZUL */}
      <div className="bg-white rounded-3xl p-1 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="bg-white rounded-2xl p-6 relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                <LayoutDashboard size={32} className="text-blue-600" />
                Control Tower <span className="text-blue-600 font-light">| Recebimento RC</span>
              </h1>
              <p className="text-gray-500 mt-2 flex items-center gap-2">
                <BrainCircuit size={16} className="text-purple-600"/>
                Simulação baseada em IA (ML.NET) para Dock Schedule e Fluxo Inbound.
              </p>
            </div>
        </div>
      </div>

      {/* CONTROLES */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-4 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200">
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">De (Segunda)</span>
                      <div className="flex items-center gap-2">
                          <CalendarRange size={16} className="text-gray-400" />
                          <input type="date" className="bg-transparent font-bold text-gray-700 outline-none text-sm" value={startDate} onChange={e => handleDateSelection(e.target.value)} />
                      </div>
                  </div>
                  <div className="h-8 w-px bg-gray-300"></div>
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Até (Domingo)</span>
                      <div className="flex items-center gap-2">
                          <input type="date" className="bg-transparent font-bold text-gray-500 outline-none text-sm cursor-not-allowed" value={endDate} disabled />
                      </div>
                  </div>
              </div>
          </div>
          <button onClick={runSimulation} disabled={loading} className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
              {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Zap size={20} fill="white" />}
              {loading ? 'Simulando Fluxo RC...' : 'Atualizar Dashboard'}
          </button>
      </div>

      {weeklyData.length > 0 && (
          <div className="space-y-6 animate-fade-in-up">
              
              {/* KPIS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <KpiCard title="Volume Inbound" value={(kpis.totalVol/1000).toFixed(1) + 'k'} icon={<Truck/>} color="blue" sub="Unidades Chegando" />
                  <KpiCard title="Pico Backlog (Cais)" value={(kpis.peakBacklog/1000).toFixed(1) + 'k'} icon={<ArrowDownCircle/>} color={kpis.peakBacklog > 50000 ? 'red' : 'green'} sub="Acúmulo Máximo" />
                  <KpiCard title="HC Médio / Turno" value={kpis.avgHc} icon={<Users/>} color="purple" sub="Recursos Necessários" />
                  <KpiCard title="Nível de Serviço" value={kpis.slaAdherence + '%'} icon={<CheckCircle2/>} color={kpis.slaAdherence > 95 ? 'green' : 'red'} sub="Meta: >98%" />
              </div>

              {/* INSIGHTS */}
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

              {/* GRÁFICOS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* CHART DE VOLUME */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                          <div>
                              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                  <TrendingUp className="text-blue-600" size={20}/>
                                  Planejamento Semanal RC
                              </h3>
                              <p className="text-xs text-gray-400">Chegada vs Processamento vs Acúmulo</p>
                          </div>
                          <div className="flex gap-4 text-xs font-bold bg-gray-50 p-2 rounded-lg">
                              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-500"></div> Chegada</div>
                              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500"></div> Processado</div>
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

                  {/* RADAR */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                      <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <Activity className="text-purple-500" size={20}/>
                          Eficiência Operacional
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">Meta vs Realizado</p>
                      
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

              {/* CRITICAL DAY (HANDOVER) */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <Clock className="text-orange-500" size={20}/>
                          Gargalo no Handover (Terça-Feira)
                      </h3>
                      <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full animate-pulse border border-orange-100">
                          Monitoramento de Docas
                      </span>
                  </div>
                  <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={hourlyTrend} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                              <defs>
                                  <linearGradient id="colorBacklogRC" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                  </linearGradient>
                                  <linearGradient id="colorEntradaRC" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                              <YAxis hide />
                              <CartesianGrid vertical={false} stroke="#f3f4f6" strokeDasharray="3 3" />
                              <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                              <Area type="monotone" dataKey="backlog" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorBacklogRC)" name="Acúmulo" />
                              <Area type="monotone" dataKey="entrada" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorEntradaRC)" name="Entrada" />
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
              <h3 className="text-xl font-bold text-gray-800">Pronto para Simular RC</h3>
              <p className="text-gray-500 max-w-sm mx-auto mt-2">Selecione uma semana para visualizar o fluxo de Recebimento.</p>
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