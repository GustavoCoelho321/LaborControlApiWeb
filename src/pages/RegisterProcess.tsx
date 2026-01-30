import { useState, useEffect } from 'react';
import { api } from '../Services/api';
import { 
  Package, Plus, Trash2, ChevronDown, ChevronUp, 
  Layers, ArrowDownCircle, ArrowUpCircle, Save, AlertTriangle, Loader2, 
  Edit, X, Check, Zap 
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

// Função auxiliar para evitar erros de case sensitive no backend
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
    standardProductivity: 0
  });

  const [newSubprocess, setNewSubprocess] = useState({
    name: '',
    standardProductivity: 0
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
      const payload = { ...newProcess, area: '-' };
      await api.post('/processes', payload);
      await loadProcesses();
      setNewProcess({ name: '', type: 'Inbound', standardProductivity: 0 }); 
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
      const payload = {
        name: editingProcess.name,
        area: '-',
        type: editingProcess.type,
        standardProductivity: Number(editingProcess.standardProductivity)
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
    if (!newSubprocess.name) {
      alert("Digite o nome do subprocesso.");
      return;
    }
    if (Number(newSubprocess.standardProductivity) <= 0) {
      alert("A meta (UPH) deve ser maior que zero.");
      return;
    }

    setSubLoading(true);
    try {
      const payload = {
        name: newSubprocess.name,
        standardProductivity: Number(newSubprocess.standardProductivity)
      };
      await api.post(`/processes/${processId}/subprocesses`, payload);
      setNewSubprocess({ name: '', standardProductivity: 0 }); 
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
        standardProductivity: Number(editingSubprocess.standardProductivity)
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

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
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

        .animate-fade-in-down {
          animation: fadeInDown 0.3s ease-out;
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
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

        .process-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .process-card:hover {
          box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.15);
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-8">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up pb-10">
          
          {/* HEADER PRINCIPAL */}
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Fundo decorativo */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-dhl-red/5 to-dhl-yellow/5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-dhl-yellow/5 to-dhl-red/5 rounded-full blur-3xl"></div>
            
            <div className="relative p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-dhl-red to-red-600 rounded-2xl blur opacity-50"></div>
                    <div className="relative w-16 h-16 bg-gradient-to-br from-dhl-red to-red-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300">
                      <Package className="text-white" size={32} />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      Cadastro Operacional
                    </h1>
                    <p className="text-gray-500 mt-1 flex items-center gap-2">
                      <Zap size={14} className="text-dhl-yellow" />
                      <span>Gerencie processos macro e subprocessos</span>
                    </p>
                  </div>
                </div>
                
                <div className="hidden md:block">
                  <div className="relative bg-gradient-to-br from-dhl-red to-red-600 rounded-2xl p-6 shadow-xl">
                    <div className="absolute inset-0 shimmer rounded-2xl"></div>
                    <div className="relative text-center">
                      <p className="text-white/80 text-sm font-medium mb-1">Total de Processos</p>
                      <p className="text-white text-4xl font-bold">{processes.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FORMULÁRIO DE CRIAÇÃO */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden card-hover">
            <div className="bg-gradient-to-br from-dhl-yellow via-yellow-400 to-yellow-500 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                  <Plus className="text-white" size={22} />
                </div>
                <div>
                  <h2 className="font-bold text-2xl text-white drop-shadow-lg">Novo Processo Principal</h2>
                  <p className="text-white/90 text-sm mt-0.5">Cadastre um novo processo macro</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleCreateProcess} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Nome do Processo</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Recebimento"
                    className="input-focus w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none bg-gray-50 font-medium transition-all duration-300 hover:border-gray-300 focus:bg-white focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/20"
                    value={newProcess.name}
                    onChange={e => setNewProcess({...newProcess, name: e.target.value})}
                    required
                  />
                </div>
                
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Tipo</label>
                  <select 
                    className="input-focus w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none bg-gray-50 font-medium transition-all duration-300 hover:border-gray-300 focus:bg-white focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/20 appearance-none cursor-pointer"
                    value={newProcess.type}
                    onChange={e => setNewProcess({...newProcess, type: e.target.value as 'Inbound' | 'Outbound'})}
                    required
                  >
                    <option value="Inbound">📥 Inbound (Entrada)</option>
                    <option value="Outbound">📤 Outbound (Saída)</option>
                  </select>
                </div>
                
                <div className="md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Produtividade (UPH)</label>
                  <input 
                    type="number" 
                    min="1"
                    placeholder="Ex: 100"
                    className="input-focus w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none bg-gray-50 font-medium transition-all duration-300 hover:border-gray-300 focus:bg-white focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/20"
                    value={newProcess.standardProductivity}
                    onChange={e => setNewProcess({...newProcess, standardProductivity: Number(e.target.value)})}
                    required
                  />
                </div>
                
                <div className="flex items-end">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="btn-hover w-full bg-gradient-to-r from-dhl-yellow to-yellow-500 text-gray-900 font-bold px-6 py-3 rounded-xl hover:from-yellow-500 hover:to-yellow-600 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                      {loading ? 'Salvando...' : 'Cadastrar'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* LISTAGEM DE PROCESSOS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-2xl text-gray-900">Processos Cadastrados</h3>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-bold text-gray-700">{processes.length} processo{processes.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            
            {processes.length === 0 && (
              <div className="animate-fade-in-up">
                <div className="relative bg-white rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden">
                  <div className="p-16 text-center">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-gray-200 rounded-full blur-xl opacity-50"></div>
                      <div className="relative w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package className="text-gray-400" size={36} />
                      </div>
                    </div>
                    <p className="text-gray-600 font-semibold text-lg">Nenhum processo cadastrado</p>
                    <p className="text-gray-400 text-sm mt-1">Utilize o formulário acima para começar</p>
                  </div>
                </div>
              </div>
            )}

            {processes.map((process, index) => (
              <div 
                key={process.id} 
                className="process-card bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden animate-scale-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                
                {/* CABEÇALHO DO CARD */}
                <div 
                  className="p-6 flex items-center justify-between cursor-pointer bg-gradient-to-r from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 transition-all duration-300"
                  onClick={() => setExpandedProcessId(expandedProcessId === process.id ? null : process.id)}
                >
                  <div className="flex items-center gap-5">
                    <div className={`relative p-3 rounded-2xl shadow-lg transform hover:scale-110 transition-transform duration-300 ${
                      process.type === 'Inbound' 
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                        : 'bg-gradient-to-br from-blue-500 to-blue-600'
                    }`}>
                      <div className="absolute inset-0 shimmer rounded-2xl"></div>
                      {process.type === 'Inbound' 
                        ? <ArrowDownCircle className="text-white relative z-10" size={28} /> 
                        : <ArrowUpCircle className="text-white relative z-10" size={28} />
                      }
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-xl text-gray-900 mb-1">{process.name}</h4>
                      <div className="flex items-center gap-3 text-sm">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold shadow-sm ${
                          process.type === 'Inbound' 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                          {process.type === 'Inbound' ? '📥 Inbound' : '📤 Outbound'}
                        </span>
                        <span className="text-gray-600 bg-gray-100 px-3 py-1 rounded-lg font-medium">
                          Meta: <strong className="text-gray-900">{process.standardProductivity}</strong> un/h
                        </span>
                        <span className="text-gray-500 bg-gray-50 px-3 py-1 rounded-lg text-xs font-medium">
                          {getSubprocesses(process).length} subprocesso{getSubprocesses(process).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingProcess(process); }}
                      className="group relative inline-flex items-center justify-center w-10 h-10 text-blue-600 hover:text-white transition-all duration-300 rounded-xl overflow-hidden shadow-sm hover:shadow-lg"
                      title="Editar Processo"
                    >
                      <div className="absolute inset-0 bg-blue-600 transform scale-0 group-hover:scale-100 transition-transform duration-300 rounded-xl"></div>
                      <Edit size={18} className="relative z-10" />
                    </button>

                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteProcess(process.id); }}
                      className="group relative inline-flex items-center justify-center w-10 h-10 text-gray-400 hover:text-white transition-all duration-300 rounded-xl overflow-hidden shadow-sm hover:shadow-lg"
                      title="Excluir Processo"
                    >
                      <div className="absolute inset-0 bg-red-500 transform scale-0 group-hover:scale-100 transition-transform duration-300 rounded-xl"></div>
                      <Trash2 size={18} className="relative z-10" />
                    </button>
                    
                    <div className="w-px h-8 bg-gray-300 mx-2"></div>
                    
                    <div className={`p-2 rounded-lg transition-all duration-300 ${
                      expandedProcessId === process.id ? 'bg-dhl-yellow/10' : 'bg-gray-100'
                    }`}>
                      {expandedProcessId === process.id 
                        ? <ChevronUp className="text-gray-700" size={20} /> 
                        : <ChevronDown className="text-gray-400" size={20} />
                      }
                    </div>
                  </div>
                </div>

                {/* ÁREA EXPANDIDA (SUBPROCESSOS) */}
                {expandedProcessId === process.id && (
                  <div className="bg-gradient-to-br from-gray-50 to-white p-6 border-t-2 border-gray-100 animate-fade-in-down">
                    
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-10 h-10 bg-gradient-to-br from-dhl-yellow to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                        <Layers className="text-white" size={18} />
                      </div>
                      <h5 className="text-lg font-bold text-gray-900">Subprocessos</h5>
                    </div>

                    <div className="space-y-3 mb-6">
                      {getSubprocesses(process).length === 0 ? (
                        <div className="flex items-center gap-3 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-yellow-700 animate-slide-in">
                          <AlertTriangle size={20} />
                          <span className="font-medium">Nenhum subprocesso cadastrado. Adicione abaixo.</span>
                        </div>
                      ) : (
                        getSubprocesses(process).map((sub: Subprocess, subIndex: number) => (
                          <div 
                            key={sub.id} 
                            className="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 animate-slide-in"
                            style={{ animationDelay: `${subIndex * 0.05}s` }}
                          >
                            
                            {editingSubprocess?.id === sub.id ? (
                              // MODO EDIÇÃO
                              <div className="flex items-center gap-3 animate-fade-in">
                                <input 
                                  type="text" 
                                  className="flex-1 px-4 py-2.5 border-2 border-blue-300 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
                                  value={editingSubprocess.name}
                                  onChange={e => setEditingSubprocess({...editingSubprocess, name: e.target.value})}
                                />
                                <input 
                                  type="number" 
                                  className="w-28 px-4 py-2.5 border-2 border-blue-300 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
                                  value={editingSubprocess.standardProductivity}
                                  onChange={e => setEditingSubprocess({...editingSubprocess, standardProductivity: Number(e.target.value)})}
                                />
                                <button 
                                  onClick={handleUpdateSubprocess}
                                  className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                                  title="Salvar"
                                >
                                  <Check size={18} />
                                </button>
                                <button 
                                  onClick={() => setEditingSubprocess(null)}
                                  className="bg-gray-200 text-gray-600 p-2.5 rounded-xl hover:bg-gray-300 transition-all"
                                  title="Cancelar"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            ) : (
                              // MODO VISUALIZAÇÃO
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="w-1.5 h-10 bg-gradient-to-b from-dhl-yellow to-yellow-500 rounded-full"></div>
                                  <span className="font-bold text-gray-900">{sub.name}</span>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium text-gray-600 bg-gray-100 px-4 py-2 rounded-lg border border-gray-200">
                                    Meta: <strong className="text-gray-900">{sub.standardProductivity}</strong> un/h
                                  </span>
                                  
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => setEditingSubprocess(sub)}
                                      className="group relative inline-flex items-center justify-center w-9 h-9 text-blue-600 hover:text-white transition-all duration-300 rounded-lg overflow-hidden"
                                    >
                                      <div className="absolute inset-0 bg-blue-600 transform scale-0 group-hover:scale-100 transition-transform duration-300 rounded-lg"></div>
                                      <Edit size={16} className="relative z-10" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteSubprocess(sub.id)}
                                      className="group relative inline-flex items-center justify-center w-9 h-9 text-gray-400 hover:text-white transition-all duration-300 rounded-lg overflow-hidden"
                                    >
                                      <div className="absolute inset-0 bg-red-500 transform scale-0 group-hover:scale-100 transition-transform duration-300 rounded-lg"></div>
                                      <Trash2 size={16} className="relative z-10" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* INPUTS PARA ADICIONAR NOVO */}
                    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-5 rounded-xl border-2 border-dashed border-yellow-300">
                      <div className="flex flex-col md:flex-row items-center gap-3">
                        <input 
                          type="text" 
                          placeholder="Nome do Novo Subprocesso..."
                          className="flex-1 px-4 py-3 border-2 border-yellow-200 rounded-xl text-sm font-medium outline-none focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/20 bg-white transition-all"
                          value={newSubprocess.name}
                          onChange={e => setNewSubprocess({...newSubprocess, name: e.target.value})}
                        />
                        <input 
                          type="number" 
                          placeholder="Meta (UPH)"
                          className="w-full md:w-36 px-4 py-3 border-2 border-yellow-200 rounded-xl text-sm font-medium outline-none focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/20 bg-white transition-all"
                          value={newSubprocess.standardProductivity || ''}
                          onChange={e => setNewSubprocess({...newSubprocess, standardProductivity: Number(e.target.value)})}
                        />
                        <button 
                          type="button"
                          disabled={subLoading}
                          onClick={() => handleCreateSubprocess(process.id)}
                          className="btn-hover bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg hover:shadow-xl w-full md:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            {subLoading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                            Adicionar
                          </span>
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ))}
          </div>

          {/* MODAL DE EDIÇÃO */}
          {editingProcess && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border-2 border-gray-100">
                
                <div className="bg-gradient-to-br from-dhl-red to-red-600 p-6 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                      <Edit className="text-white" size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-2xl text-white drop-shadow-lg">Editar Processo</h3>
                      <p className="text-white/90 text-sm mt-0.5">Atualize as informações</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setEditingProcess(null)} 
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                <form onSubmit={handleUpdateProcess} className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Nome do Processo</label>
                    <input 
                      type="text" 
                      className="input-focus w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none bg-gray-50 font-medium transition-all duration-300 hover:border-gray-300 focus:bg-white focus:border-dhl-red focus:ring-4 focus:ring-dhl-red/20"
                      value={editingProcess.name}
                      onChange={e => setEditingProcess({...editingProcess, name: e.target.value})}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Tipo</label>
                      <select 
                        className="input-focus w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none bg-gray-50 font-medium transition-all duration-300 hover:border-gray-300 focus:bg-white focus:border-dhl-red focus:ring-4 focus:ring-dhl-red/20 appearance-none cursor-pointer"
                        value={editingProcess.type}
                        onChange={e => setEditingProcess({...editingProcess, type: e.target.value as 'Inbound' | 'Outbound'})}
                      >
                        <option value="Inbound">📥 Inbound</option>
                        <option value="Outbound">📤 Outbound</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Meta Geral (UPH)</label>
                      <input 
                        type="number" 
                        className="input-focus w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none bg-gray-50 font-medium transition-all duration-300 hover:border-gray-300 focus:bg-white focus:border-dhl-red focus:ring-4 focus:ring-dhl-red/20"
                        value={editingProcess.standardProductivity}
                        onChange={e => setEditingProcess({...editingProcess, standardProductivity: Number(e.target.value)})}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setEditingProcess(null)}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all shadow-sm"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="btn-hover flex-1 py-3 bg-gradient-to-r from-dhl-yellow to-yellow-500 text-gray-900 font-bold rounded-xl hover:from-yellow-500 hover:to-yellow-600 transition-all shadow-lg hover:shadow-xl"
                    >
                      <span className="relative z-10">Salvar Alterações</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}