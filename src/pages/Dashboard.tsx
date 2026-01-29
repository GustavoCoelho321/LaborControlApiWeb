import { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, ComposedChart, PieChart, Pie, Cell
} from 'recharts';
import { 
  LayoutDashboard, TrendingUp, TrendingDown, Users, Package, 
  AlertTriangle, ArrowRight, Activity, Clock
} from 'lucide-react';

// --- DADOS MOCKADOS (Simulando o Backend) ---
const HOURLY_DATA = [
  { hour: '06:00', input: 5000, output: 4200, backlog: 800, uph: 120, meta: 130 },
  { hour: '07:00', input: 8000, output: 7500, backlog: 1300, uph: 128, meta: 130 },
  { hour: '08:00', input: 12000, output: 11000, backlog: 2300, uph: 135, meta: 130 },
  { hour: '09:00', input: 15000, output: 14000, backlog: 3300, uph: 140, meta: 130 },
  { hour: '10:00', input: 10000, output: 12000, backlog: 1300, uph: 138, meta: 130 },
  { hour: '11:00', input: 6000, output: 5000, backlog: 2300, uph: 90, meta: 130 }, // Refeição
  { hour: '12:00', input: 5000, output: 4000, backlog: 3300, uph: 85, meta: 130 }, // Refeição
  { hour: '13:00', input: 14000, output: 15000, backlog: 2300, uph: 142, meta: 130 },
  { hour: '14:00', input: 16000, output: 16500, backlog: 1800, uph: 145, meta: 130 },
  { hour: '15:00', input: 12000, output: 13000, backlog: 800, uph: 139, meta: 130 },
  { hour: '16:00', input: 0, output: 0, backlog: 0, uph: 0, meta: 130 }, // Futuro
  { hour: '17:00', input: 0, output: 0, backlog: 0, uph: 0, meta: 130 },
];

const HC_DISTRIBUTION = [
  { name: 'Recebimento', value: 15, color: '#16a34a' }, // Green
  { name: 'Picking', value: 45, color: '#2563eb' },     // Blue
  { name: 'Packing', value: 20, color: '#9333ea' },     // Purple
  { name: 'Expedição', value: 10, color: '#ea580c' },   // Orange
];

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'Inbound' | 'Outbound'>('Inbound');

  // Totais Acumulados (Simulação)
  const totalInput = HOURLY_DATA.reduce((acc, curr) => acc + curr.input, 0);
  const totalOutput = HOURLY_DATA.reduce((acc, curr) => acc + curr.output, 0);
  const currentBacklog = 45200; // Valor fixo simulado de "Agora"
  const backlogLimit = activeTab === 'Inbound' ? 50000 : 130000;
  const isBacklogCritical = currentBacklog > backlogLimit;

  return (
    <div className="space-y-6 animate-fade-in-up pb-20">
      
      {/* HEADER & FILTROS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <LayoutDashboard className="text-dhl-red" />
            Control Tower - {activeTab}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Monitoramento em tempo real da saúde operacional.
          </p>
        </div>
        
        {/* Toggle In/Out */}
        <div className="bg-gray-100 p-1 rounded-lg flex">
          <button 
            onClick={() => setActiveTab('Inbound')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'Inbound' ? 'bg-white text-dhl-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Inbound
          </button>
          <button 
            onClick={() => setActiveTab('Outbound')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'Outbound' ? 'bg-white text-dhl-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Outbound
          </button>
        </div>
      </div>

      {/* --- KPI CARDS (FLASH REPORT) --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Card 1: Volume Entrada */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Volume Entrada (Acum.)</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{(totalInput / 1000).toFixed(1)}k</h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Package size={20}/></div>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-green-600">
            <TrendingUp size={14}/> +12% vs Meta
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-blue-500 w-[70%]"></div>
        </div>

        {/* Card 2: Volume Saída */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Volume Saída (Acum.)</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{(totalOutput / 1000).toFixed(1)}k</h3>
            </div>
            <div className="p-2 bg-green-50 rounded-lg text-green-600"><ArrowRight size={20}/></div>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-red-500">
            <TrendingDown size={14}/> -5% vs Meta
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-green-500 w-[65%]"></div>
        </div>

        {/* Card 3: Backlog Atual */}
        <div className={`p-4 rounded-xl border shadow-sm relative overflow-hidden ${isBacklogCritical ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className={`text-xs font-bold uppercase ${isBacklogCritical ? 'text-red-500' : 'text-gray-400'}`}>Backlog Atual</p>
              <h3 className={`text-2xl font-bold mt-1 ${isBacklogCritical ? 'text-red-700' : 'text-gray-800'}`}>
                {(currentBacklog / 1000).toFixed(1)}k
              </h3>
            </div>
            <div className={`p-2 rounded-lg ${isBacklogCritical ? 'bg-red-200 text-red-700' : 'bg-orange-50 text-orange-600'}`}>
              <AlertTriangle size={20}/>
            </div>
          </div>
          <p className="text-xs text-gray-500">Limite: <strong>{(backlogLimit/1000).toFixed(0)}k</strong></p>
          {isBacklogCritical && <span className="text-[10px] font-bold text-red-600 animate-pulse">CRÍTICO: AÇÃO NECESSÁRIA</span>}
        </div>

        {/* Card 4: HC Ativo */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Pessoas Ativas</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">90</h3>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Users size={20}/></div>
          </div>
          <div className="flex justify-between items-end">
             <span className="text-xs text-gray-500">Planejado: <strong>92</strong></span>
             <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">98% Aderência</span>
          </div>
        </div>
      </div>

      {/* --- GRÁFICOS PRINCIPAIS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO 1: EVOLUÇÃO DO BACKLOG (BOCA DE JACARÉ) - Ocupa 2 colunas */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Activity size={18} className="text-blue-500"/>
                Evolução do Fluxo (Hora a Hora)
              </h3>
              <p className="text-xs text-gray-400">Comparativo Entrada vs Saída e impacto no Estoque.</p>
            </div>
            <div className="flex gap-4 text-xs font-bold">
               <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> Entrada</div>
               <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-full"></div> Saída</div>
               <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-400 rounded-full"></div> Backlog</div>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={HOURLY_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                  labelStyle={{fontWeight: 'bold', color: '#374151'}}
                />
                
                {/* Backlog como Área de Fundo */}
                <Area type="monotone" dataKey="backlog" fill="#ffedd5" stroke="#fb923c" strokeWidth={2} fillOpacity={0.4} name="Backlog" />
                
                {/* Linhas de Entrada e Saída */}
                <Line type="monotone" dataKey="input" stroke="#3b82f6" strokeWidth={3} dot={{r: 3}} activeDot={{r: 6}} name="Entrada" />
                <Line type="monotone" dataKey="output" stroke="#22c55e" strokeWidth={3} dot={{r: 3}} activeDot={{r: 6}} name="Saída" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO 2: DISTRIBUIÇÃO DE HC (ROSCA) */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Users size={18} className="text-purple-500"/>
            Alocação Atual
          </h3>
          <p className="text-xs text-gray-400 mb-6">Onde as pessoas estão trabalhando neste momento.</p>

          <div className="flex-1 min-h-[200px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={HC_DISTRIBUTION}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {HC_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px'}}/>
              </PieChart>
            </ResponsiveContainer>
            {/* Texto Central */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-[-10px]">
               <span className="text-3xl font-bold text-gray-800 block">90</span>
               <span className="text-[10px] text-gray-400 uppercase tracking-wider">Pessoas</span>
            </div>
          </div>
        </div>

      </div>

      {/* --- LINHA DE BAIXO: PRODUTIVIDADE E ALERTAS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO 3: PRODUTIVIDADE (UPH) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Clock size={18} className="text-green-600"/>
                Produtividade Média (UPH)
             </h3>
             <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">Meta Global: 130 un/h</span>
          </div>
          
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={HOURLY_DATA} margin={{ top: 5, right: 0, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                <Tooltip 
                   cursor={{fill: '#f3f4f6'}}
                   contentStyle={{borderRadius: '8px', border: 'none'}}
                />
                <Legend wrapperStyle={{fontSize: '11px'}} />
                
                <Bar dataKey="uph" name="Realizado" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30}>
                   {HOURLY_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.uph < entry.meta ? '#ef4444' : '#22c55e'} />
                   ))}
                </Bar>
                {/* Linha de Meta dentro do gráfico de barras (simulada com Line) */}
                <Line type="monotone" dataKey="meta" stroke="#9ca3af" strokeDasharray="5 5" dot={false} strokeWidth={2} name="Meta" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LISTA DE GARGALOS (ALERTAS) */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
           <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-dhl-red"/>
              Pontos de Atenção
           </h3>
           <div className="space-y-3">
              
              {/* Alerta 1 */}
              <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                 <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-gray-800">Picking - Sorter 3D</span>
                    <span className="text-xs font-bold text-red-600">Crítico</span>
                 </div>
                 <p className="text-xs text-gray-600 mt-1">Backlog subiu 15% na última hora. HC insuficiente.</p>
              </div>

              {/* Alerta 2 */}
              <div className="p-3 bg-orange-50 border-l-4 border-orange-400 rounded-r-lg">
                 <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-gray-800">Packing</span>
                    <span className="text-xs font-bold text-orange-600">Atenção</span>
                 </div>
                 <p className="text-xs text-gray-600 mt-1">Produtividade abaixo da meta (90 vs 110).</p>
              </div>

              {/* Alerta 3 (Neutro/Info) */}
              <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                 <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-gray-800">Troca de Turno T2</span>
                    <span className="text-xs font-bold text-blue-600">14:00</span>
                 </div>
                 <p className="text-xs text-gray-600 mt-1">Previsão de baixa de 10% na eficiência.</p>
              </div>

           </div>
        </div>

      </div>
    </div>
  );
}