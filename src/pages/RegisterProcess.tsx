import { useState, useEffect } from 'react';
import { api } from '../Services/api';
import { 
  Package, Plus, Trash2, ChevronDown, ChevronUp, 
  Layers, ArrowDownCircle, ArrowUpCircle, Save, AlertTriangle, Loader2, 
  Edit, X, Check 
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
  const [editingProcess, setEditingProcess] = useState<Process | null>(null); // Se não for null, abre o Modal
  const [editingSubprocess, setEditingSubprocess] = useState<Subprocess | null>(null); // Se não for null, a linha vira input

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
      // Payload garantindo tipos corretos
      const payload = {
        name: editingProcess.name,
        area: '-',
        type: editingProcess.type,
        standardProductivity: Number(editingProcess.standardProductivity)
      };

      await api.put(`/processes/${editingProcess.id}`, payload);
      await loadProcesses();
      setEditingProcess(null); // Fecha o modal
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
      setEditingSubprocess(null); // Sai do modo de edição
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
    <div className="space-y-8 animate-fade-in-up pb-10 relative">
      
      {/* HEADER */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="text-dhl-red" />
          Cadastro Operacional
        </h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie os processos macro e seus subprocessos.</p>
      </div>

      {/* --- FORMULÁRIO DE CRIAÇÃO (PROCESSO PAI) --- */}
      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-dhl-red">
        <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Plus size={18} /> Novo Processo Principal
        </h2>
        
        <form onSubmit={handleCreateProcess} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
            <input 
              type="text" 
              placeholder="Ex: Recebimento"
              className="w-full p-2 border rounded focus:border-dhl-yellow outline-none"
              value={newProcess.name}
              onChange={e => setNewProcess({...newProcess, name: e.target.value})}
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
            <select 
              className="w-full p-2 border rounded focus:border-dhl-yellow outline-none bg-white"
              value={newProcess.type}
              onChange={e => setNewProcess({...newProcess, type: e.target.value as 'Inbound' | 'Outbound'})}
              required
            >
              <option value="Inbound">Inbound (Entrada)</option>
              <option value="Outbound">Outbound (Saída)</option>
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Produtividade (UPH)</label>
            <input 
              type="number" 
              min="1"
              className="w-full p-2 border rounded focus:border-dhl-yellow outline-none"
              value={newProcess.standardProductivity}
              onChange={e => setNewProcess({...newProcess, standardProductivity: Number(e.target.value)})}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="bg-dhl-yellow text-dhl-red font-bold px-4 py-2 rounded hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar
          </button>
        </form>
      </div>

      {/* --- LISTAGEM DE PROCESSOS --- */}
      <div className="space-y-4">
        <h3 className="font-bold text-gray-700 ml-1">Processos Cadastrados</h3>
        
        {processes.length === 0 && (
          <div className="text-center p-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-gray-400">
            Nenhum processo encontrado. Utilize o formulário acima.
          </div>
        )}

        {processes.map(process => (
          <div key={process.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
            
            {/* CABEÇALHO DO CARD */}
            <div 
              className="p-4 flex items-center justify-between cursor-pointer bg-gradient-to-r from-white to-gray-50 hover:bg-gray-100 transition-colors"
              onClick={() => setExpandedProcessId(expandedProcessId === process.id ? null : process.id)}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${process.type === 'Inbound' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {process.type === 'Inbound' ? <ArrowDownCircle size={24} /> : <ArrowUpCircle size={24} />}
                </div>
                
                <div>
                  <h4 className="font-bold text-lg text-gray-800">{process.name}</h4>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-bold">{process.type}</span>
                    <span>Meta Padrão: <strong>{process.standardProductivity}</strong> un/h</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                 {/* Botão EDITAR PROCESSO */}
                 <button 
                    onClick={(e) => { e.stopPropagation(); setEditingProcess(process); }}
                    className="text-gray-400 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-full"
                    title="Editar Processo"
                  >
                    <Edit size={18} />
                 </button>

                 {/* Botão EXCLUIR PROCESSO */}
                 <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteProcess(process.id); }}
                    className="text-gray-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-full"
                    title="Excluir Processo"
                  >
                    <Trash2 size={18} />
                 </button>
                 
                 <div className="w-px h-6 bg-gray-300 mx-1"></div>
                 {expandedProcessId === process.id ? <ChevronUp className="text-gray-600" /> : <ChevronDown className="text-gray-400" />}
              </div>
            </div>

            {/* ÁREA EXPANDIDA (SUBPROCESSOS) */}
            {expandedProcessId === process.id && (
              <div className="bg-gray-50 p-6 border-t border-gray-200 animate-fade-in-down">
                
                <h5 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 mb-3">
                  <Layers size={14} /> Subprocessos (Filhos)
                </h5>

                <div className="space-y-3 mb-6">
                  {getSubprocesses(process).length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 italic pl-3 border-l-2 border-gray-200">
                      <AlertTriangle size={14} />
                      Nenhum subprocesso cadastrado. Adicione abaixo.
                    </div>
                  ) : (
                    getSubprocesses(process).map((sub: Subprocess) => (
                      <div key={sub.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm transition-all">
                        
                        {/* LÓGICA DE EDIÇÃO EM LINHA */}
                        {editingSubprocess?.id === sub.id ? (
                          // --- MODO EDIÇÃO DO FILHO ---
                          <div className="flex items-center gap-2 animate-fade-in">
                            <input 
                              type="text" 
                              className="flex-1 p-2 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              value={editingSubprocess.name}
                              onChange={e => setEditingSubprocess({...editingSubprocess, name: e.target.value})}
                            />
                            <input 
                              type="number" 
                              className="w-24 p-2 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              value={editingSubprocess.standardProductivity}
                              onChange={e => setEditingSubprocess({...editingSubprocess, standardProductivity: Number(e.target.value)})}
                            />
                            <button 
                              onClick={handleUpdateSubprocess}
                              className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700" title="Salvar"
                            >
                              <Check size={16} />
                            </button>
                            <button 
                              onClick={() => setEditingSubprocess(null)}
                              className="bg-gray-200 text-gray-600 p-2 rounded hover:bg-gray-300" title="Cancelar"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          // --- MODO VISUALIZAÇÃO DO FILHO ---
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="w-1 h-8 bg-dhl-yellow rounded-full"></div>
                                <span className="font-bold text-gray-700 text-sm">{sub.name}</span>
                             </div>
                             
                             <div className="flex items-center gap-4">
                               <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                 Meta: <strong>{sub.standardProductivity}</strong> un/h
                               </span>
                               
                               <div className="flex items-center gap-1">
                                 <button 
                                   onClick={() => setEditingSubprocess(sub)}
                                   className="text-gray-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded"
                                 >
                                   <Edit size={16} />
                                 </button>
                                 <button 
                                   onClick={() => handleDeleteSubprocess(sub.id)}
                                   className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded"
                                 >
                                   <Trash2 size={16} />
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
                <div className="bg-yellow-50/50 p-4 rounded-lg border border-dashed border-yellow-400 flex flex-col md:flex-row items-center gap-3">
                  <input 
                    type="text" 
                    placeholder="Nome do Novo Subprocesso..."
                    className="flex-1 p-2.5 border border-gray-300 rounded text-sm outline-none focus:border-dhl-red focus:ring-1 focus:ring-dhl-red bg-white"
                    value={newSubprocess.name}
                    onChange={e => setNewSubprocess({...newSubprocess, name: e.target.value})}
                  />
                  <input 
                    type="number" 
                    placeholder="Meta (UPH)"
                    className="w-full md:w-32 p-2.5 border border-gray-300 rounded text-sm outline-none focus:border-dhl-red focus:ring-1 focus:ring-dhl-red bg-white"
                    value={newSubprocess.standardProductivity || ''}
                    onChange={e => setNewSubprocess({...newSubprocess, standardProductivity: Number(e.target.value)})}
                  />
                  <button 
                    type="button"
                    disabled={subLoading}
                    onClick={() => handleCreateSubprocess(process.id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded font-bold text-sm flex items-center gap-2 transition-colors shadow-sm w-full md:w-auto justify-center"
                  >
                    {subLoading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    Adicionar
                  </button>
                </div>

              </div>
            )}
          </div>
        ))}
      </div>

      {/* ==================================================================================
          MODAL DE EDIÇÃO DO PROCESSO PAI
      ================================================================================== */}
      {editingProcess && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg border-t-4 border-dhl-red">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                <Edit className="text-dhl-red" size={20} /> Editar Processo
              </h3>
              <button onClick={() => setEditingProcess(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProcess} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Processo</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-gray-300 rounded focus:border-dhl-yellow outline-none"
                  value={editingProcess.name}
                  onChange={e => setEditingProcess({...editingProcess, name: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tipo</label>
                  <select 
                    className="w-full p-3 border border-gray-300 rounded focus:border-dhl-yellow outline-none bg-white"
                    value={editingProcess.type}
                    onChange={e => setEditingProcess({...editingProcess, type: e.target.value as 'Inbound' | 'Outbound'})}
                  >
                    <option value="Inbound">Inbound</option>
                    <option value="Outbound">Outbound</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Meta Geral (UPH)</label>
                  <input 
                    type="number" 
                    className="w-full p-3 border border-gray-300 rounded focus:border-dhl-yellow outline-none"
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
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-dhl-yellow text-dhl-red font-bold rounded hover:bg-yellow-400 transition-colors shadow-sm"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}