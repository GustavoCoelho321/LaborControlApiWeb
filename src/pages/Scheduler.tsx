import { useState, useEffect, useMemo } from 'react';
import { api } from '../Services/api'; 
import { 
  ArrowRight, Save, Settings2, Users,
  ArrowDownCircle, ArrowUpCircle, AlertTriangle, 
  Wand2, CalendarDays, CheckCircle2,
  CornerDownRight, Clock, GripVertical
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
  hcMatrix: Record<string, number>; 
  efficiencyMatrix: Record<number, number>;
  itemSettings: Record<string, { split: number; maxHc: number }>;
}

const DAYS_OF_WEEK = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export function Scheduler() {
  const [loading, setLoading] = useState(false);
  const [processOrder, setProcessOrder] = useState<Process[]>([]);
  const [schedulableItems, setSchedulableItems] = useState<SchedulableItem[]>([]);
  
  const [activeDayIndex, setActiveDayIndex] = useState(0); 
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // --- ESTADO DA SEMANA (7 DIAS) ---
  const [weekData, setWeekData] = useState<DayScenario[]>(
    Array.from({ length: 7 }, () => {
      const eff: Record<number, number> = {};
      for(let h=0; h<24; h++) eff[h] = 100; // Padrão 100%
      return {
        volume: 10000,
        consolidation: 100,
        shiftStart: 6,
        limitInbound: 40000,   
        limitOutbound: 130000, 
        hcMatrix: {},
        efficiencyMatrix: eff,
        itemSettings: {}
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
      setProcessOrder(response.data);
      updateSchedulableItems(response.data);
      
      // Configuração inicial padrão
      setWeekData(prev => prev.map(day => {
        const initialSettings: Record<string, { split: number; maxHc: number }> = {};
        
        // Gera settings para todos os itens possíveis
        const allItems: SchedulableItem[] = [];
        response.data.forEach((p: Process) => {
           if(p.subprocesses?.length) {
              p.subprocesses.forEach(s => allItems.push({ uniqueId: `S-${s.id}`, ...s, type: p.type, productivity: s.standardProductivity, isChild: true } as any));
           } else {
              allItems.push({ uniqueId: `P-${p.id}`, ...p, productivity: p.standardProductivity, isChild: false } as any);
           }
        });

        allItems.forEach(item => {
          initialSettings[item.uniqueId] = { split: 100, maxHc: 20 };
        });
        return { ...day, itemSettings: initialSettings };
      }));

    } catch (error) {
      console.error("Erro ao carregar processos", error);
    } finally {
      setLoading(false);
    }
  }

  // Atualiza a lista plana sempre que a ordem muda
  const updateSchedulableItems = (order: Process[]) => {
    const flatList: SchedulableItem[] = [];
    order.forEach(p => {
      if (p.subprocesses && p.subprocesses.length > 0) {
        p.subprocesses.forEach(sub => {
          flatList.push({
            uniqueId: `S-${sub.id}`,
            name: sub.name,
            type: p.type,
            productivity: sub.standardProductivity,
            parentId: p.id,
            isChild: true
          });
        });
      } else {
        flatList.push({
          uniqueId: `P-${p.id}`,
          name: p.name,
          type: p.type,
          productivity: p.standardProductivity,
          isChild: false
        });
      }
    });
    setSchedulableItems(flatList);
  };

  // --- GETTERS E SETTERS ---
  const currentDayData = weekData[activeDayIndex];

  const updateCurrentDay = (field: keyof DayScenario, value: any) => {
    setWeekData(prev => {
      const newData = [...prev];
      newData[activeDayIndex] = { ...newData[activeDayIndex], [field]: value };
      return newData;
    });
  };

  const handleHcChange = (itemId: string, hour: number, val: string) => {
    const newMatrix = { ...currentDayData.hcMatrix, [`${itemId}-${hour}`]: Number(val) };
    updateCurrentDay('hcMatrix', newMatrix);
  };

  const handleEfficiencyChange = (hour: number, val: string) => {
    const newMatrix = { ...currentDayData.efficiencyMatrix, [hour]: Number(val) };
    updateCurrentDay('efficiencyMatrix', newMatrix);
  };

  const handleSettingChange = (itemId: string, field: 'split' | 'maxHc', val: number) => {
    const newSettings = { ...currentDayData.itemSettings };
    if (!newSettings[itemId]) newSettings[itemId] = { split: 100, maxHc: 20 };
    newSettings[itemId] = { ...newSettings[itemId], [field]: val };
    updateCurrentDay('itemSettings', newSettings);
  };

  // --- DRAG AND DROP ---
  const handleDragStart = (index: number) => setDraggedItemIndex(index);
  const handleDrop = (index: number) => {
    if (draggedItemIndex === null) return;
    const newOrder = [...processOrder];
    const itemDragged = newOrder[draggedItemIndex];
    newOrder.splice(draggedItemIndex, 1);
    newOrder.splice(index, 0, itemDragged);
    setProcessOrder(newOrder);
    updateSchedulableItems(newOrder);
    setDraggedItemIndex(null);
  };

  // ==================================================================================
  //  ENGINE DE CÁLCULO SEMANAL (HERANÇA DE BACKLOG)
  // ==================================================================================
  const weekSimulation = useMemo(() => {
    // Armazena o resultado de TODOS os dias
    // Estrutura: results[dayIndex][itemId] = SimulationCell[]
    const fullWeekResults: Record<number, Record<string, SimulationCell[]>> = {};
    const daysHours: Record<number, number[]> = {};

    // Estado acumulado que passa de um dia para o outro
    let carryOverBacklogs: Record<string, number> = {};

    // Itera sobre os 7 dias (0 a 6)
    weekData.forEach((dayData, dayIdx) => {
       const dayResults: Record<string, SimulationCell[]> = {};
       const hoursArray = Array.from({ length: 24 }, (_, i) => (dayData.shiftStart + i) % 24);
       daysHours[dayIdx] = hoursArray;

       // 1. Input Inicial do Dia (Chegada de carretas - Inbound)
       // Simulação linear nas primeiras 10h
       let previousProcessOutput: number[] = hoursArray.map((_, i) => i < 10 ? dayData.volume / 10 : 0);

       // 2. Calcula cada processo NA ORDEM
       schedulableItems.forEach((item, idx) => {
          const itemCells: SimulationCell[] = [];
          
          // Pega backlog herdado do dia anterior (ou 0 se for Segunda)
          let currentBacklog = carryOverBacklogs[item.uniqueId] || 0;
          
          const settings = dayData.itemSettings[item.uniqueId] || { split: 100, maxHc: 20 };
          
          // Lógica de Multiplicador (Consolidação Inbound -> Outbound)
          // Verifica se mudou de tipo em relação ao item ANTERIOR na lista
          const isTypeChange = idx > 0 && schedulableItems[idx-1].type === 'Inbound' && item.type === 'Outbound';
          const typeMultiplier = isTypeChange ? (dayData.consolidation / 100) : 1;
          const finalMultiplier = typeMultiplier * (settings.split / 100);

          hoursArray.forEach((hour, hIdx) => {
             const input = previousProcessOutput[hIdx] * finalMultiplier;
             const hc = dayData.hcMatrix[`${item.uniqueId}-${hour}`] || 0;
             const efficiency = (dayData.efficiencyMatrix[hour] ?? 100) / 100;
             
             const capacity = hc * item.productivity * efficiency;
             
             const totalAvailable = input + currentBacklog;
             const output = Math.min(totalAvailable, capacity);
             const newBacklog = totalAvailable - output;
             
             currentBacklog = newBacklog;

             itemCells.push({ 
               hour, input, efficiency: efficiency * 100, 
               capacity, output, backlog: newBacklog 
             });
          });

          dayResults[item.uniqueId] = itemCells;

          // Atualiza o carryOver para o próximo dia (O último backlog do dia atual)
          carryOverBacklogs[item.uniqueId] = currentBacklog;
          
          // O output deste item vira input do próximo no fluxo do mesmo dia
          previousProcessOutput = itemCells.map(c => c.output);
       });

       fullWeekResults[dayIdx] = dayResults;
    });

    return { fullWeekResults, daysHours };
  }, [weekData, schedulableItems, processOrder]);


  // ==================================================================================
  //  ALGORITMO "SMOOTH" (DISTRIBUIÇÃO SUAVIZADA)
  // ==================================================================================
  const handleSmartDistribute = () => {
    if (!confirm("O sistema irá distribuir as pessoas uniformemente ao longo do dia. Continuar?")) return;

    const newMatrix = { ...currentDayData.hcMatrix };
    const hoursArray = weekSimulation.daysHours[activeDayIndex];
    
    // Precisamos recalcular os inputs esperados para o dia atual
    // Para isso, olhamos o backlog herdado (startBacklog) + volume do dia
    
    // Pega os backlogs finais do dia anterior
    let startBacklogs: Record<string, number> = {};
    if (activeDayIndex > 0) {
       const prevDayRes = weekSimulation.fullWeekResults[activeDayIndex - 1];
       Object.keys(prevDayRes).forEach(key => {
          const cells = prevDayRes[key];
          startBacklogs[key] = cells[cells.length - 1].backlog;
       });
    }

    // Input "Fresco" do dia (Volume) - simulado linear
    let previousOutput = hoursArray.map((_, i) => i < 10 ? currentDayData.volume / 10 : 0);

    schedulableItems.forEach((item, idx) => {
       const settings = currentDayData.itemSettings[item.uniqueId] || { split: 100, maxHc: 20 };
       
       // Fatores de multiplicação
       const isTypeChange = idx > 0 && schedulableItems[idx-1].type === 'Inbound' && item.type === 'Outbound';
       const typeMultiplier = isTypeChange ? (currentDayData.consolidation / 100) : 1;
       const splitMultiplier = settings.split / 100;
       
       // 1. Calcular DEMANDA TOTAL (Carga de trabalho)
       // Demanda = Backlog Inicial + Input Total do Dia
       const initialBacklog = startBacklogs[item.uniqueId] || 0;
       const dayInputTotal = previousOutput.reduce((a, b) => a + b, 0) * typeMultiplier * splitMultiplier;
       const totalDemand = initialBacklog + dayInputTotal;

       // 2. Calcular HORAS ÚTEIS DISPONÍVEIS
       // Soma das eficiências do dia (ex: se 1 hora tem 50% de ef, conta como 0.5 hora útil)
       let totalEffectiveHours = 0;
       hoursArray.forEach(h => {
          totalEffectiveHours += (currentDayData.efficiencyMatrix[h] ?? 100) / 100;
       });

       // 3. Calcular HC MÉDIO NECESSÁRIO (Nivelamento)
       // HC = Demanda / (Produtividade * Horas Úteis)
       let smoothHC = 0;
       if (item.productivity > 0 && totalEffectiveHours > 0) {
          smoothHC = Math.ceil(totalDemand / (item.productivity * totalEffectiveHours));
       }

       // Limita ao máximo permitido pelo usuário
       smoothHC = Math.min(smoothHC, settings.maxHc);

       // 4. Aplicar HC Suave
       // Cria vetor de output para alimentar o próximo processo
       const currentItemOutputs: number[] = [];
       let runningBacklog = initialBacklog;

       hoursArray.forEach((h, hIdx) => {
          const efficiency = (currentDayData.efficiencyMatrix[h] ?? 100) / 100;
          
          // Se for hora morta (0%), põe 0 pessoas
          if (efficiency === 0) {
             newMatrix[`${item.uniqueId}-${h}`] = 0;
             currentItemOutputs.push(0);
             return;
          }

          // Aplica o HC Médio calculado
          newMatrix[`${item.uniqueId}-${h}`] = smoothHC;

          // Simula output para passar pro próximo
          const hourInput = previousOutput[hIdx] * typeMultiplier * splitMultiplier;
          const capacity = smoothHC * item.productivity * efficiency;
          const available = hourInput + runningBacklog;
          const out = Math.min(available, capacity);
          
          runningBacklog = available - out;
          currentItemOutputs.push(out);
       });

       // Passa o output para o próximo processo da lista
       previousOutput = currentItemOutputs;
    });

    updateCurrentDay('hcMatrix', newMatrix);
  };

  // Pega resultados do dia ativo para renderizar
  const activeResults = weekSimulation.fullWeekResults[activeDayIndex] || {};
  const activeHours = weekSimulation.daysHours[activeDayIndex] || [];
  
  // KPIs do Dia
  let dayBacklogIn = 0;
  let dayBacklogOut = 0;
  Object.keys(activeResults).forEach(key => {
     const cells = activeResults[key];
     const lastVal = cells[cells.length - 1].backlog;
     // Identifica tipo pelo schedulableItems
     const item = schedulableItems.find(i => i.uniqueId === key);
     if(item?.type === 'Inbound') dayBacklogIn += lastVal;
     else dayBacklogOut += lastVal;
  });

  return (
    <div className="space-y-6 animate-fade-in-up pb-20">
      
      {/* HEADER FIXO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Settings2 className="text-dhl-red" />
            Simulador Semanal Integrado
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Backlog acumula entre os dias. Distribuição suavizada de HC.
          </p>
        </div>
        <div className="flex gap-2">
           <div className="flex flex-col items-end mr-4">
             <span className={`text-xs font-bold ${dayBacklogIn > currentDayData.limitInbound ? 'text-dhl-red' : 'text-green-600'}`}>
                Backlog In: {(dayBacklogIn/1000).toFixed(1)}k / {(currentDayData.limitInbound/1000).toFixed(0)}k
             </span>
             <span className={`text-xs font-bold ${dayBacklogOut > currentDayData.limitOutbound ? 'text-dhl-red' : 'text-green-600'}`}>
                Backlog Out: {(dayBacklogOut/1000).toFixed(1)}k / {(currentDayData.limitOutbound/1000).toFixed(0)}k
             </span>
           </div>
           <button 
             onClick={handleSmartDistribute}
             className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 hover:bg-purple-700 transition-all shadow-purple-200"
             title="Nivelar HC durante o dia"
           >
            <Wand2 size={18} /> Distribuir Suave
          </button>
          <button className="bg-dhl-red text-white px-4 py-2 rounded-lg font-bold shadow-sm flex items-center gap-2 hover:bg-red-700 transition-all">
            <Save size={18} /> Salvar Semana
          </button>
        </div>
      </div>

      {/* --- NAVEGAÇÃO DE DIAS --- */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {DAYS_OF_WEEK.map((day, idx) => (
          <button
            key={day}
            onClick={() => setActiveDayIndex(idx)}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-t-lg font-bold text-sm transition-all border-b-2 whitespace-nowrap
              ${activeDayIndex === idx 
                ? 'bg-white border-dhl-red text-dhl-red shadow-sm transform -translate-y-1' 
                : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200'
              }
            `}
          >
            <CalendarDays size={16} />
            {day}
          </button>
        ))}
      </div>

      {/* --- CONTEÚDO DO DIA --- */}
      <div className="bg-white p-6 rounded-b-lg rounded-r-lg shadow-md border-t-4 border-dhl-yellow relative top-[-10px]">
        
        {/* PARÂMETROS GERAIS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
           <div className="md:col-span-1">
             <label className="text-[10px] font-bold text-gray-400 uppercase">Volume Entrada</label>
             <input type="number" className="w-full font-bold bg-transparent border-b border-gray-300" value={currentDayData.volume} onChange={e => updateCurrentDay('volume', Number(e.target.value))} />
           </div>
           <div className="md:col-span-1">
             <label className="text-[10px] font-bold text-gray-400 uppercase">Consolidação (%)</label>
             <input type="number" className="w-full font-bold bg-transparent border-b border-gray-300" value={currentDayData.consolidation} onChange={e => updateCurrentDay('consolidation', Number(e.target.value))} />
           </div>
           <div className="md:col-span-1">
             <label className="text-[10px] font-bold text-gray-400 uppercase">Início Turno</label>
             <select className="w-full font-bold bg-transparent border-b border-gray-300" value={currentDayData.shiftStart} onChange={e => updateCurrentDay('shiftStart', Number(e.target.value))}>
                {Array.from({length: 24}, (_, i) => <option key={i} value={i}>{i}:00</option>)}
             </select>
           </div>
        </div>

        {/* --- FLUXO OPERACIONAL (DRAG & DROP) --- */}
        <div className="mb-8">
          <h3 className="font-bold text-gray-700 mb-3 text-xs uppercase flex items-center gap-2">
            <Settings2 size={14} /> Sequência do Fluxo (Arraste para Ordenar)
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

        {/* --- LINHA MESTRA DE EFICIÊNCIA (REFEIÇÕES) --- */}
        <div className="mb-8 overflow-x-auto border border-orange-200 rounded-lg bg-orange-50/30">
            <div className="flex min-w-max">
                <div className="p-3 w-[200px] font-bold text-orange-600 flex items-center gap-2 sticky left-0 bg-orange-50 z-10 border-r border-orange-200 shadow-sm">
                    <Clock size={16} /> % Eficiência (Refeição)
                </div>
                {activeHours.map(h => (
                    <div key={h} className="p-2 min-w-[65px] border-r border-orange-100 text-center">
                        <div className="text-[10px] text-gray-400 mb-1">{h.toString().padStart(2, '0')}:00</div>
                        <input 
                            type="number" 
                            min="0" max="100"
                            className="w-full text-center font-bold text-orange-600 bg-white border border-orange-200 rounded px-1 text-xs"
                            value={currentDayData.efficiencyMatrix[h] ?? 100}
                            onChange={e => handleEfficiencyChange(h, e.target.value)}
                        />
                    </div>
                ))}
            </div>
        </div>

        {/* --- GRID DE PROCESSOS --- */}
        <div className="space-y-8">
          {processOrder.map((parentProc) => {
            // Renderiza apenas itens deste pai
            const items = schedulableItems.filter(i => 
              (i.isChild && i.parentId === parentProc.id) || 
              (!i.isChild && i.uniqueId === `P-${parentProc.id}`)
            );

            return (
              <div key={parentProc.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white ring-1 ring-gray-100">
                
                {/* HEADER PAI */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                   <div className={`p-2 rounded-lg ${parentProc.type === 'Inbound' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                     {parentProc.type === 'Inbound' ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
                   </div>
                   <h4 className="font-bold text-gray-800 text-base">{parentProc.name}</h4>
                </div>

                {/* SUBPROCESSOS */}
                <div className="divide-y divide-gray-100">
                  {items.map(item => {
                    const data = activeResults[item.uniqueId] || [];
                    const settings = currentDayData.itemSettings[item.uniqueId] || { split: 100, maxHc: 20 };
                    const initialBacklog = data.length > 0 ? data[0].input - data[0].output + (data[0].backlog - data[0].input + data[0].output) : 0; 

                    return (
                      <div key={item.uniqueId} className="bg-white">
                         <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50">
                            <div className="flex items-center gap-2 pl-2">
                               {item.isChild && <CornerDownRight size={14} className="text-gray-400" />}
                               <span className="text-sm font-bold text-gray-700">{item.name}</span>
                               <span className="text-[10px] text-gray-500 ml-2">Meta: <strong>{item.productivity}</strong></span>
                            </div>
                            <div className="flex gap-4">
                               <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase">Vol %</span>
                                  <input 
                                    type="number" className="w-10 text-xs text-center border rounded"
                                    value={settings.split} onChange={e => handleSettingChange(item.uniqueId, 'split', Number(e.target.value))}
                                  />
                               </div>
                               <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase">Max HC</span>
                                  <input 
                                    type="number" className="w-10 text-xs text-center border rounded"
                                    value={settings.maxHc} onChange={e => handleSettingChange(item.uniqueId, 'maxHc', Number(e.target.value))}
                                  />
                               </div>
                            </div>
                         </div>

                         <div className="overflow-x-auto">
                            <table className="w-full text-xs text-center border-collapse">
                                <thead>
                                    <tr className="bg-gray-100/50 text-gray-400">
                                       <th className="p-2 w-[180px] text-left pl-6 sticky left-0 bg-gray-50 z-10">Indicador</th>
                                       {activeHours.map(h => (
                                          <th key={h} className="min-w-[65px] border-r border-gray-100 font-normal">
                                            {h.toString().padStart(2, '0')}:00
                                          </th>
                                       ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* HC INPUT */}
                                    <tr>
                                       <td className="p-2 font-bold text-gray-700 text-left pl-6 sticky left-0 bg-white z-10 border-r border-gray-200 flex items-center gap-2">
                                          <Users size={12} className="text-blue-500"/> HC
                                       </td>
                                       {activeHours.map(h => (
                                          <td key={h} className="p-1 border-r border-gray-100">
                                              <input 
                                                  type="number" 
                                                  className="w-full text-center font-bold text-blue-600 bg-blue-50/10 rounded focus:bg-white hover:bg-white transition-colors"
                                                  value={currentDayData.hcMatrix[`${item.uniqueId}-${h}`] || 0}
                                                  onChange={e => handleHcChange(item.uniqueId, h, e.target.value)}
                                              />
                                          </td>
                                       ))}
                                    </tr>

                                    {/* OUTPUT */}
                                    <tr className="bg-green-50/10">
                                       <td className="p-2 text-green-700 text-left pl-6 sticky left-0 bg-white z-10 border-r border-gray-200">Produção</td>
                                       {data.map((d, i) => (
                                          <td key={i} className="p-1 border-r border-gray-100 text-green-700 font-medium">
                                              {Math.round(d.output)}
                                          </td>
                                       ))}
                                    </tr>

                                    {/* BACKLOG */}
                                    <tr>
                                       <td className="p-2 text-dhl-red text-left pl-6 sticky left-0 bg-white z-10 border-r border-gray-200 flex items-center gap-1">
                                          <AlertTriangle size={10}/> Backlog
                                       </td>
                                       {data.map((d, i) => (
                                          <td key={i} className={`p-1 border-r border-gray-100 font-bold ${d.backlog > 0 ? 'text-dhl-red' : 'text-gray-200'}`}>
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
            );
          })}
        </div>

      </div>
    </div>
  );
}