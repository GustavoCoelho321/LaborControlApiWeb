import { useState, useEffect } from 'react';
import { api } from '../Services/api';
import { 
  Package, Plus, Trash2, ChevronDown, ChevronUp, 
  Layers, ArrowDownCircle, ArrowUpCircle, Save, Loader2, 
  Edit, X, Check, Zap, Warehouse, Clock, Activity
} from 'lucide-react';

// --- INTERFACES (SEM FADIGA) ---
interface Subprocess {
  id: number;
  name: string;
  standardProductivity: number;
  efficiency: number; 
  travelTime: number; 
  processId: number;
}

interface Process {
  id: number;
  name: string;
  type: 'Inbound' | 'Outbound';
  warehouse?: string;
  standardProductivity: number;
  efficiency: number; 
  travelTime: number; 
  subprocesses: Subprocess[];
}

const getSubprocesses = (p: any) => {
  return p.subprocesses || p.Subprocesses || [];
};

export function RegisterProcess() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  
  const [expandedProcessId, setExpandedProcessId] = useState<number | null>(null);

  // --- ESTADOS DE CRIAÇÃO ---
  const [newProcess, setNewProcess] = useState({
    name: '',
    type: 'Inbound', 
    warehouse: 'M03', 
    standardProductivity: 0,
    efficiency: 100, // Visualmente 0-100
    travelTime: 0
  });

  const [newSubprocess, setNewSubprocess] = useState({
    name: '',
    standardProductivity: 0,
    efficiency: 100,
    travelTime: 0
  });

  // --- ESTADOS DE EDIÇÃO ---
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [editingSubprocess, setEditingSubprocess] = useState<Subprocess | null>(null);

  useEffect(() => {
    loadProcesses();
  }, []);

  async function loadProcesses() {
    try {
      const response = await api.get('/processes');
      setProcesses(response.data);
    } catch (error) {
      console.error("Erro ao carregar processos", error);
    }
  }

  // ==================================================================================
  // AÇÕES DO PROCESSO (PAI)
  // ==================================================================================

  async function handleCreateProcess(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { 
          ...newProcess, 
          area: '-',
          // Converte 100 (visual) para 1.0 (banco)
          efficiency: Number(newProcess.efficiency) / 100, 
      };
      await api.post('/processes', payload);
      await loadProcesses();
      setNewProcess({ name: '', type: 'Inbound', warehouse: 'M03', standardProductivity: 0, efficiency: 100, travelTime: 0 }); 
      alert("Processo criado com sucesso!");
    } catch (error) {
      alert('Erro ao criar processo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProcess(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProcess) return;

    try {
      // CORREÇÃO DO BUG 100%: 
      // O estado editingProcess.efficiency já está em decimal (0.9, 1.0) pois tratamos no onChange.
      // Então enviamos direto, sem dividir novamente.
      const payload = {
        name: editingProcess.name,
        area: '-',
        type: editingProcess.type,
        warehouse: editingProcess.warehouse,
        standardProductivity: Number(editingProcess.standardProductivity),
        efficiency: Number(editingProcess.efficiency), // Envia direto (já é decimal)
        travelTime: Number(editingProcess.travelTime)
      };

      await api.put(`/processes/${editingProcess.id}`, payload);
      await loadProcesses();
      setEditingProcess(null);
    } catch (error) {
      alert('Erro ao atualizar processo.');
    }
  }

  async function handleDeleteProcess(id: number) {
    if (!confirm('ATENÇÃO: Deletar um processo apagará todos os seus subprocessos. Continuar?')) return;
    try {
      await api.delete(`/processes/${id}`);
      loadProcesses();
    } catch (error) {
      alert('Erro ao deletar processo.');
    }
  }

  // ==================================================================================
  // AÇÕES DO SUBPROCESSO (FILHO)
  // ==================================================================================

  async function handleCreateSubprocess(processId: number) {
    if (!newSubprocess.name) return alert("Digite o nome do subprocesso.");
    
    setSubLoading(true);
    try {
      const payload = {
        name: newSubprocess.name,
        standardProductivity: Number(newSubprocess.standardProductivity),
        efficiency: Number(newSubprocess.efficiency) / 100, // Converte visual para decimal
        travelTime: Number(newSubprocess.travelTime)
      };
      await api.post(`/processes/${processId}/subprocesses`, payload);
      setNewSubprocess({ name: '', standardProductivity: 0, efficiency: 100, travelTime: 0 }); 
      await loadProcesses();
    } catch (error: any) {
      alert('Erro ao adicionar subprocesso.');
    } finally {
      setSubLoading(false);
    }
  }

  async function handleUpdateSubprocess() {
    if (!editingSubprocess) return;

    try {
      const payload = {
        name: editingSubprocess.name,
        standardProductivity: Number(editingSubprocess.standardProductivity),
        efficiency: Number(editingSubprocess.efficiency), // Já está decimal no estado
        travelTime: Number(editingSubprocess.travelTime)
      };

      await api.put(`/processes/subprocesses/${editingSubprocess.id}`, payload);
      await loadProcesses();
      setEditingSubprocess(null);
    } catch (error) {
      alert('Erro ao atualizar subprocesso.');
    }
  }

  async function handleDeleteSubprocess(id: number) {
    if (!confirm('Excluir este subprocesso?')) return;
    try {
      await api.delete(`/processes/subprocesses/${id}`);
      await loadProcesses();
    } catch (error) {
      alert('Erro ao deletar subprocesso.');
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
        
        .input-focus:focus { transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
        .input-focus { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
        .card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        
        .btn-hover { position: relative; overflow: hidden; transition: all 0.3s; }
        .btn-hover:active { transform: scale(0.95); }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-8">
        <div className="max-w-7xl mx-auto space-y-8 pb-10">
          
          {/* HEADER PRINCIPAL */}
          <div className="relative bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-dhl-red/5 to-dhl-yellow/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
            
            <div className="relative p-8 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-gradient-to-br from-dhl-red to-red-700 rounded-2xl flex items-center justify-center shadow-2xl transform -rotate-3 hover:rotate-0 transition-all duration-300">
                  <Package className="text-white" size={40} />
                </div>
                <div>
                  <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                    Cadastro Operacional
                  </h1>
                  <p className="text-gray-500 mt-1 flex items-center gap-2 font-medium">
                    <Zap size={16} className="text-dhl-yellow fill-dhl-yellow" />
                    Gestão de processos e produtividade
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FORMULÁRIO DE CRIAÇÃO */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden card-hover animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="bg-gradient-to-r from-gray-50 to-white p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-dhl-yellow rounded-xl flex items-center justify-center shadow-lg shadow-yellow-200">
                  <Plus className="text-white" size={24} />
                </div>
                <h2 className="font-bold text-xl text-gray-800">Novo Processo Principal</h2>
              </div>
            </div>
            
            <form onSubmit={handleCreateProcess} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* LINHA 1 */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">Nome do Processo</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Recebimento"
                    className="input-focus w-full px-4 py-3.5 border border-gray-200 rounded-xl outline-none bg-gray-50/50 font-bold text-gray-700 focus:bg-white focus:border-dhl-yellow"
                    value={newProcess.name}
                    onChange={e => setNewProcess({...newProcess, name: e.target.value})}
                    required
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">Tipo</label>
                  <select 
                    className="input-focus w-full px-4 py-3.5 border border-gray-200 rounded-xl outline-none bg-gray-50/50 font-bold text-gray-700 cursor-pointer"
                    value={newProcess.type}
                    onChange={e => setNewProcess({...newProcess, type: e.target.value as 'Inbound' | 'Outbound'})}
                  >
                    <option value="Inbound">📥 Inbound</option>
                    <option value="Outbound">📤 Outbound</option>
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">Warehouse</label>
                  <select 
                    className="input-focus w-full px-4 py-3.5 border border-gray-200 rounded-xl outline-none bg-gray-50/50 font-bold text-gray-700 cursor-pointer"
                    value={newProcess.warehouse}
                    onChange={e => setNewProcess({...newProcess, warehouse: e.target.value})}
                  >
                    <option value="M03">M03</option>
                    <option value="RC">RC</option>
                  </select>
                </div>

                {/* LINHA 2 */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1 flex items-center gap-1"><Zap size={12}/> Meta (UPH)</label>
                  <input 
                    type="number" 
                    className="input-focus w-full px-4 py-3 border border-gray-200 rounded-xl outline-none text-center font-black text-gray-800"
                    value={newProcess.standardProductivity}
                    onChange={e => setNewProcess({...newProcess, standardProductivity: Number(e.target.value)})}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1 flex items-center gap-1"><Activity size={12}/> Eficiência (%)</label>
                  <input 
                    type="number" 
                    className="input-focus w-full px-4 py-3 border border-gray-200 rounded-xl outline-none text-center font-black text-blue-600"
                    value={newProcess.efficiency}
                    onChange={e => setNewProcess({...newProcess, efficiency: Number(e.target.value)})}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1 flex items-center gap-1"><Clock size={12}/> Desloc. (min)</label>
                  <input 
                    type="number" 
                    className="input-focus w-full px-4 py-3 border border-gray-200 rounded-xl outline-none text-center font-black text-orange-600"
                    value={newProcess.travelTime}
                    onChange={e => setNewProcess({...newProcess, travelTime: Number(e.target.value)})}
                  />
                </div>
                
                <div className="md:col-span-1 flex items-end">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="btn-hover w-full bg-gradient-to-r from-dhl-yellow to-yellow-500 text-gray-900 font-bold px-6 py-3.5 rounded-xl hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    Cadastrar
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* LISTAGEM DE PROCESSOS */}
          <div className="space-y-6">
            <h3 className="font-bold text-2xl text-gray-900 px-2 border-l-4 border-dhl-red">Processos Ativos</h3>
            
            {processes.map((process, index) => (
              <div 
                key={process.id} 
                className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${0.2 + (index * 0.1)}s` }}
              >
                
                {/* CABEÇALHO DO CARD */}
                <div 
                  className="p-6 flex flex-col md:flex-row items-center justify-between cursor-pointer group"
                  onClick={() => setExpandedProcessId(expandedProcessId === process.id ? null : process.id)}
                >
                  <div className="flex items-center gap-6 w-full">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110 ${process.type === 'Inbound' ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'}`}>
                      {process.type === 'Inbound' ? <ArrowDownCircle className="text-white" size={32} /> : <ArrowUpCircle className="text-white" size={32} />}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-bold text-xl text-gray-900">{process.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${process.type === 'Inbound' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{process.type}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            <Zap size={14} className="text-dhl-yellow"/> 
                            <span className="font-bold">{process.standardProductivity}</span> <span className="text-xs text-gray-400">UPH</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            <Activity size={14} className="text-blue-500"/> 
                            <span className="font-bold">{(process.efficiency * 100).toFixed(0)}%</span> <span className="text-xs text-gray-400">Efic.</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            <Clock size={14} className="text-orange-500"/> 
                            <span className="font-bold">{process.travelTime}</span> <span className="text-xs text-gray-400">min</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            <Warehouse size={14} className="text-purple-500"/> 
                            <span className="font-bold">{process.warehouse || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setEditingProcess(process); }} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"><Edit size={20} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteProcess(process.id); }} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"><Trash2 size={20} /></button>
                        <div className={`transform transition-transform duration-300 ${expandedProcessId === process.id ? 'rotate-180' : ''}`}>
                            <ChevronDown size={24} className="text-gray-400" />
                        </div>
                    </div>
                  </div>
                </div>

                {/* ÁREA EXPANDIDA (SUBPROCESSOS) */}
                {expandedProcessId === process.id && (
                  <div className="bg-gray-50/50 p-6 border-t border-gray-100 animate-fade-in-up">
                    <h5 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Layers size={16}/> Subprocessos Vinculados</h5>

                    <div className="grid grid-cols-1 gap-3 mb-6">
                      {getSubprocesses(process).map((sub: Subprocess) => (
                        <div key={sub.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 hover:border-dhl-yellow transition-colors">
                            {editingSubprocess?.id === sub.id ? (
                                // EDITANDO SUB (CORREÇÃO DE INPUT 100%)
                                <div className="flex flex-wrap gap-3 w-full items-center">
                                    <input type="text" className="flex-1 px-4 py-2 border rounded-lg font-bold text-gray-700" value={editingSubprocess.name} onChange={e => setEditingSubprocess({...editingSubprocess, name: e.target.value})} />
                                    <input type="number" className="w-24 px-3 py-2 border rounded-lg text-center" placeholder="UPH" value={editingSubprocess.standardProductivity} onChange={e => setEditingSubprocess({...editingSubprocess, standardProductivity: Number(e.target.value)})} />
                                    <div className="relative">
                                        <input type="number" className="w-20 px-3 py-2 border rounded-lg text-center" 
                                            value={(editingSubprocess.efficiency * 100).toFixed(0)} 
                                            onChange={e => setEditingSubprocess({...editingSubprocess, efficiency: Number(e.target.value) / 100})} 
                                        />
                                        <span className="absolute right-2 top-2 text-xs text-gray-400">%</span>
                                    </div>
                                    <input type="number" className="w-20 px-3 py-2 border rounded-lg text-center" placeholder="Min" value={editingSubprocess.travelTime} onChange={e => setEditingSubprocess({...editingSubprocess, travelTime: Number(e.target.value)})} />
                                    
                                    <button onClick={handleUpdateSubprocess} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600"><Check size={18}/></button>
                                    <button onClick={() => setEditingSubprocess(null)} className="bg-gray-200 text-gray-500 p-2 rounded-lg hover:bg-gray-300"><X size={18}/></button>
                                </div>
                            ) : (
                                // VISUALIZANDO SUB
                                <>
                                    <div className="flex items-center gap-4">
                                        <div className="w-1.5 h-10 bg-dhl-yellow rounded-full"></div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-lg">{sub.name}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-6">
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Meta</p>
                                            <p className="font-bold text-gray-700">{sub.standardProductivity}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Efic.</p>
                                            <p className="font-bold text-blue-600">{(sub.efficiency * 100).toFixed(0)}%</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Tempo</p>
                                            <p className="font-bold text-orange-600">{sub.travelTime}m</p>
                                        </div>
                                        
                                        <div className="flex gap-2 pl-4 border-l border-gray-100">
                                            <button onClick={() => setEditingSubprocess(sub)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors"><Edit size={16}/></button>
                                            <button onClick={() => handleDeleteSubprocess(sub.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                      ))}
                    </div>

                    {/* ADD SUBPROCESS FORM */}
                    <div className="bg-white p-5 rounded-xl border-2 border-dashed border-gray-300 hover:border-dhl-yellow transition-colors group">
                        <div className="flex items-center gap-2 mb-3 text-gray-400 group-hover:text-dhl-yellow transition-colors">
                            <Plus size={18} /> <span className="font-bold text-sm">Adicionar Novo Subprocesso</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                            <div className="md:col-span-2">
                                <input type="text" className="w-full px-4 py-2.5 bg-gray-50 border-gray-200 border rounded-lg text-sm font-medium outline-none focus:bg-white focus:border-dhl-yellow transition-all" placeholder="Nome do Subprocesso" value={newSubprocess.name} onChange={e => setNewSubprocess({...newSubprocess, name: e.target.value})} />
                            </div>
                            <div>
                                <input type="number" className="w-full px-4 py-2.5 bg-gray-50 border-gray-200 border rounded-lg text-sm font-medium text-center outline-none focus:bg-white focus:border-dhl-yellow transition-all" placeholder="UPH" value={newSubprocess.standardProductivity || ''} onChange={e => setNewSubprocess({...newSubprocess, standardProductivity: Number(e.target.value)})} />
                            </div>
                            <div>
                                <input type="number" className="w-full px-4 py-2.5 bg-gray-50 border-gray-200 border rounded-lg text-sm font-medium text-center outline-none focus:bg-white focus:border-dhl-yellow transition-all" placeholder="Efic %" value={newSubprocess.efficiency} onChange={e => setNewSubprocess({...newSubprocess, efficiency: Number(e.target.value)})} />
                            </div>
                            <div>
                                <input type="number" className="w-full px-4 py-2.5 bg-gray-50 border-gray-200 border rounded-lg text-sm font-medium text-center outline-none focus:bg-white focus:border-dhl-yellow transition-all" placeholder="Min" value={newSubprocess.travelTime} onChange={e => setNewSubprocess({...newSubprocess, travelTime: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                            <button onClick={() => handleCreateSubprocess(process.id)} disabled={subLoading} className="bg-gray-900 text-white font-bold py-2 px-6 rounded-lg text-xs hover:bg-black transition-all flex items-center gap-2">
                                {subLoading ? <Loader2 className="animate-spin" size={14}/> : <Plus size={14}/>} SALVAR SUBPROCESSO
                            </button>
                        </div>
                    </div>

                  </div>
                )}
              </div>
            ))}
          </div>

          {/* MODAL DE EDIÇÃO DO PAI */}
          {editingProcess && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in-up">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 transform scale-100">
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 flex justify-between items-center text-white">
                    <h3 className="font-bold text-xl flex items-center gap-3"><Edit size={24} className="text-dhl-yellow"/> Editar Processo</h3>
                    <button onClick={() => setEditingProcess(null)} className="hover:bg-white/10 p-2 rounded-full transition-all"><X size={24}/></button>
                </div>
                <form onSubmit={handleUpdateProcess} className="p-8 space-y-6">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1">Nome</label>
                        <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700 outline-none focus:bg-white focus:border-dhl-yellow focus:ring-4 focus:ring-yellow-50 transition-all" value={editingProcess.name} onChange={e => setEditingProcess({...editingProcess, name: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1">UPH</label>
                            <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700 outline-none focus:bg-white focus:border-dhl-yellow" value={editingProcess.standardProductivity} onChange={e => setEditingProcess({...editingProcess, standardProductivity: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1">Eficiência (%)</label>
                            {/* CORREÇÃO AQUI: Mostra 100, Salva 1.0 */}
                            <input 
                                type="number" 
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-blue-600 outline-none focus:bg-white focus:border-dhl-yellow" 
                                value={(editingProcess.efficiency * 100).toFixed(0)} 
                                onChange={e => setEditingProcess({...editingProcess, efficiency: Number(e.target.value) / 100})} 
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1">Desloc. (min)</label>
                            <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-orange-600 outline-none focus:bg-white focus:border-dhl-yellow" value={editingProcess.travelTime} onChange={e => setEditingProcess({...editingProcess, travelTime: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1">Warehouse</label>
                            <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700 outline-none focus:bg-white focus:border-dhl-yellow" value={editingProcess.warehouse} onChange={e => setEditingProcess({...editingProcess, warehouse: e.target.value})}>
                                <option value="M03">M03</option>
                                <option value="RC">RC</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-gradient-to-r from-dhl-red to-red-700 text-white font-bold py-4 rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all">Salvar Alterações</button>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}