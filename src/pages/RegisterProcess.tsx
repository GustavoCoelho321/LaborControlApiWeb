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

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
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

        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(255, 204, 0, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(255, 204, 0, 0.6);
          }
        }

        @keyframes rotate-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-slide-in-right {
          animation: slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-scale-in {
          animation: scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .shimmer-effect {
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.3),
            transparent
          );
          background-size: 1000px 100%;
          animation: shimmer 3s infinite;
        }
        
        .input-focus {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .input-focus:focus {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }
        
        .card-hover {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .card-hover:hover {
          transform: translateY(-6px);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
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
          transform: scale(0.97);
        }

        .icon-rotate {
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .icon-rotate:hover {
          transform: rotate(15deg) scale(1.1);
        }

        .badge-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        .gradient-animate {
          background-size: 200% 200%;
          animation: gradient-shift 3s ease infinite;
        }

        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .stat-card {
          position: relative;
          overflow: hidden;
        }

        .stat-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s;
        }

        .stat-card:hover::after {
          left: 100%;
        }

        .glass-effect {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .text-gradient {
          background: linear-gradient(135deg, #dc0032 0%, #ffcc00 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .border-gradient {
          border-image: linear-gradient(135deg, #dc0032, #ffcc00) 1;
        }

        .expand-enter {
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .expand-enter-active {
          max-height: 2000px;
          opacity: 1;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 p-8">
        <div className="max-w-7xl mx-auto space-y-8 pb-10">
          
          {/* HEADER PRINCIPAL COM ANIMAÇÕES MELHORADAS */}
          <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-up">
            {/* Elementos decorativos de fundo */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-dhl-red/10 to-dhl-yellow/10 rounded-full blur-3xl -mr-20 -mt-20 animate-float"></div>
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 rounded-full blur-3xl -ml-10 -mb-10"></div>
            
            <div className="relative p-8 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-gradient-to-br from-dhl-red to-red-700 rounded-2xl flex items-center justify-center shadow-2xl transform hover:rotate-0 transition-all duration-500 icon-rotate animate-pulse-glow">
                  <Package className="text-white" size={40} />
                </div>
                <div>
                  <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">
                    Cadastro Operacional
                  </h1>
                  <p className="text-gray-500 flex items-center gap-2 font-medium">
                    <Zap size={16} className="text-dhl-yellow fill-dhl-yellow animate-pulse" />
                    Gestão de processos e produtividade
                  </p>
                </div>
              </div>

              {/* Badge animado */}
              <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-dhl-yellow/20 to-orange-400/20 px-4 py-2 rounded-full border border-dhl-yellow/30 animate-slide-in-right">
                <Activity size={16} className="text-dhl-red" />
                <span className="text-sm font-bold text-gray-700">Sistema Ativo</span>
              </div>
            </div>
          </div>

          {/* FORMULÁRIO DE CRIAÇÃO COM ANIMAÇÕES APRIMORADAS */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden card-hover animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <div className="relative bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-6 border-b border-gray-700 overflow-hidden">
              <div className="absolute inset-0 shimmer-effect opacity-20"></div>
              <div className="relative flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-dhl-yellow to-orange-400 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/50 icon-rotate">
                  <Plus className="text-gray-900" size={24} strokeWidth={3} />
                </div>
                <div>
                  <h2 className="font-black text-xl text-white tracking-tight">Novo Processo Principal</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Preencha os campos para cadastrar</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleCreateProcess} className="p-8 bg-gradient-to-br from-gray-50/50 to-white">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* LINHA 1 */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-dhl-red"></div>
                    Nome do Processo
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ex: Recebimento de Mercadorias"
                    className="input-focus w-full px-5 py-4 border-2 border-gray-200 rounded-xl outline-none bg-white font-bold text-gray-700 focus:bg-blue-50/30 focus:border-dhl-yellow shadow-sm hover:shadow-md transition-all"
                    value={newProcess.name}
                    onChange={e => setNewProcess({...newProcess, name: e.target.value})}
                    required
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    Tipo
                  </label>
                  <select 
                    className="input-focus w-full px-5 py-4 border-2 border-gray-200 rounded-xl outline-none bg-white font-bold text-gray-700 cursor-pointer shadow-sm hover:shadow-md transition-all focus:border-dhl-yellow"
                    value={newProcess.type}
                    onChange={e => setNewProcess({...newProcess, type: e.target.value as 'Inbound' | 'Outbound'})}
                  >
                    <option value="Inbound">📥 Inbound</option>
                    <option value="Outbound">📤 Outbound</option>
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                    Warehouse
                  </label>
                  <select 
                    className="input-focus w-full px-5 py-4 border-2 border-gray-200 rounded-xl outline-none bg-white font-bold text-gray-700 cursor-pointer shadow-sm hover:shadow-md transition-all focus:border-dhl-yellow"
                    value={newProcess.warehouse}
                    onChange={e => setNewProcess({...newProcess, warehouse: e.target.value})}
                  >
                    <option value="M03">🏭 M03</option>
                    <option value="RC">📦 RC</option>
                  </select>
                </div>

                {/* LINHA 2 */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-1.5">
                    <Zap size={14} className="text-dhl-yellow fill-dhl-yellow"/>
                    Meta (UPH)
                  </label>
                  <input 
                    type="number" 
                    className="input-focus w-full px-4 py-4 border-2 border-gray-200 rounded-xl outline-none text-center font-black text-xl text-gray-800 bg-gradient-to-br from-yellow-50 to-white shadow-sm hover:shadow-md transition-all focus:border-dhl-yellow"
                    value={newProcess.standardProductivity}
                    onChange={e => setNewProcess({...newProcess, standardProductivity: Number(e.target.value)})}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-1.5">
                    <Activity size={14} className="text-blue-600"/>
                    Eficiência (%)
                  </label>
                  <input 
                    type="number" 
                    className="input-focus w-full px-4 py-4 border-2 border-gray-200 rounded-xl outline-none text-center font-black text-xl text-blue-600 bg-gradient-to-br from-blue-50 to-white shadow-sm hover:shadow-md transition-all focus:border-blue-500"
                    value={newProcess.efficiency}
                    onChange={e => setNewProcess({...newProcess, efficiency: Number(e.target.value)})}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-1.5">
                    <Clock size={14} className="text-orange-600"/>
                    Desloc. (min)
                  </label>
                  <input 
                    type="number" 
                    className="input-focus w-full px-4 py-4 border-2 border-gray-200 rounded-xl outline-none text-center font-black text-xl text-orange-600 bg-gradient-to-br from-orange-50 to-white shadow-sm hover:shadow-md transition-all focus:border-orange-500"
                    value={newProcess.travelTime}
                    onChange={e => setNewProcess({...newProcess, travelTime: Number(e.target.value)})}
                  />
                </div>
                
                <div className="md:col-span-1 flex items-end">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="btn-hover w-full bg-gradient-to-r from-dhl-yellow via-yellow-400 to-yellow-500 text-gray-900 font-black px-6 py-4 rounded-xl hover:shadow-2xl flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 shadow-lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={22} />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Save size={22} />
                        <span>Cadastrar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* LISTAGEM DE PROCESSOS COM ANIMAÇÕES APRIMORADAS */}
          <div className="space-y-6">
            <div className="flex items-center gap-4 px-2 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="h-8 w-1.5 bg-gradient-to-b from-dhl-red to-dhl-yellow rounded-full"></div>
              <h3 className="font-black text-3xl text-gray-900">Processos Ativos</h3>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
              <div className="bg-dhl-red/10 px-4 py-2 rounded-full border border-dhl-red/20">
                <span className="text-sm font-bold text-dhl-red">{processes.length} {processes.length === 1 ? 'Processo' : 'Processos'}</span>
              </div>
            </div>
            
            {processes.map((process, index) => (
              <div 
                key={process.id} 
                className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 animate-fade-in-up"
                style={{ animationDelay: `${0.4 + (index * 0.1)}s` }}
              >
                
                {/* CABEÇALHO DO CARD */}
                <div 
                  className="p-6 flex flex-col md:flex-row items-center justify-between cursor-pointer group relative overflow-hidden"
                  onClick={() => setExpandedProcessId(expandedProcessId === process.id ? null : process.id)}
                >
                  {/* Efeito de fundo ao hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  <div className="relative flex items-center gap-6 w-full z-10">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 ${process.type === 'Inbound' ? 'bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600' : 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600'}`}>
                      {process.type === 'Inbound' ? 
                        <ArrowDownCircle className="text-white drop-shadow-lg" size={32} /> : 
                        <ArrowUpCircle className="text-white drop-shadow-lg" size={32} />
                      }
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="font-black text-2xl text-gray-900 group-hover:text-dhl-red transition-colors">{process.name}</h4>
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm ${process.type === 'Inbound' ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200' : 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-200'}`}>
                          {process.type}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <div className="stat-card flex items-center gap-2 text-gray-700 bg-gradient-to-br from-yellow-50 to-orange-50 px-4 py-2.5 rounded-xl border border-yellow-200 shadow-sm hover:shadow-md transition-all">
                            <Zap size={16} className="text-dhl-yellow fill-dhl-yellow"/> 
                            <span className="font-black text-base">{process.standardProductivity}</span>
                            <span className="text-xs text-gray-500 font-semibold">UPH</span>
                        </div>
                        <div className="stat-card flex items-center gap-2 text-gray-700 bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-2.5 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-all">
                            <Activity size={16} className="text-blue-500"/> 
                            <span className="font-black text-base">{(process.efficiency * 100).toFixed(0)}%</span>
                            <span className="text-xs text-gray-500 font-semibold">Efic.</span>
                        </div>
                        <div className="stat-card flex items-center gap-2 text-gray-700 bg-gradient-to-br from-orange-50 to-red-50 px-4 py-2.5 rounded-xl border border-orange-200 shadow-sm hover:shadow-md transition-all">
                            <Clock size={16} className="text-orange-500"/> 
                            <span className="font-black text-base">{process.travelTime}</span>
                            <span className="text-xs text-gray-500 font-semibold">min</span>
                        </div>
                        <div className="stat-card flex items-center gap-2 text-gray-700 bg-gradient-to-br from-purple-50 to-pink-50 px-4 py-2.5 rounded-xl border border-purple-200 shadow-sm hover:shadow-md transition-all">
                            <Warehouse size={16} className="text-purple-500"/> 
                            <span className="font-black text-base">{process.warehouse || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingProcess(process); }} 
                          className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all hover:scale-110 shadow-md hover:shadow-lg"
                        >
                          <Edit size={20} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteProcess(process.id); }} 
                          className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all hover:scale-110 shadow-md hover:shadow-lg"
                        >
                          <Trash2 size={20} />
                        </button>
                        <div className={`transform transition-all duration-500 p-2 rounded-xl bg-gray-100 ${expandedProcessId === process.id ? 'rotate-180 bg-dhl-yellow' : ''}`}>
                            <ChevronDown size={24} className={`transition-colors ${expandedProcessId === process.id ? 'text-gray-900' : 'text-gray-400'}`} />
                        </div>
                    </div>
                  </div>
                </div>

                {/* ÁREA EXPANDIDA (SUBPROCESSOS) */}
                {expandedProcessId === process.id && (
                  <div className="bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 p-8 border-t-2 border-gray-200 animate-fade-in-up">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-gradient-to-br from-dhl-red to-dhl-yellow rounded-xl flex items-center justify-center shadow-lg">
                        <Layers size={20} className="text-white"/>
                      </div>
                      <h5 className="text-base font-black text-gray-700 uppercase tracking-wide">Subprocessos Vinculados</h5>
                      <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
                      <span className="text-xs font-bold text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                        {getSubprocesses(process).length} {getSubprocesses(process).length === 1 ? 'Item' : 'Itens'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 mb-8">
                      {getSubprocesses(process).map((sub: Subprocess, subIndex: number) => (
                        <div 
                          key={sub.id} 
                          className="bg-white p-5 rounded-xl border-2 border-gray-200 shadow-md flex flex-col md:flex-row items-center justify-between gap-4 hover:border-dhl-yellow hover:shadow-xl transition-all duration-300 animate-slide-in-right"
                          style={{ animationDelay: `${subIndex * 0.1}s` }}
                        >
                            {editingSubprocess?.id === sub.id ? (
                                // EDITANDO SUB (CORREÇÃO DE INPUT 100%)
                                <div className="flex flex-wrap gap-3 w-full items-center">
                                    <input 
                                      type="text" 
                                      className="flex-1 min-w-[200px] px-4 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-700 focus:border-dhl-yellow focus:ring-4 focus:ring-yellow-50 outline-none transition-all" 
                                      value={editingSubprocess.name} 
                                      onChange={e => setEditingSubprocess({...editingSubprocess, name: e.target.value})} 
                                    />
                                    <input 
                                      type="number" 
                                      className="w-28 px-3 py-3 border-2 border-gray-300 rounded-xl text-center font-bold focus:border-dhl-yellow focus:ring-4 focus:ring-yellow-50 outline-none transition-all" 
                                      placeholder="UPH" 
                                      value={editingSubprocess.standardProductivity} 
                                      onChange={e => setEditingSubprocess({...editingSubprocess, standardProductivity: Number(e.target.value)})} 
                                    />
                                    <div className="relative">
                                        <input 
                                          type="number" 
                                          className="w-24 px-3 py-3 border-2 border-gray-300 rounded-xl text-center font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all" 
                                          value={(editingSubprocess.efficiency * 100).toFixed(0)} 
                                          onChange={e => setEditingSubprocess({...editingSubprocess, efficiency: Number(e.target.value) / 100})} 
                                        />
                                        <span className="absolute right-3 top-3 text-xs text-gray-400 font-bold">%</span>
                                    </div>
                                    <input 
                                      type="number" 
                                      className="w-24 px-3 py-3 border-2 border-gray-300 rounded-xl text-center font-bold focus:border-orange-500 focus:ring-4 focus:ring-orange-50 outline-none transition-all" 
                                      placeholder="Min" 
                                      value={editingSubprocess.travelTime} 
                                      onChange={e => setEditingSubprocess({...editingSubprocess, travelTime: Number(e.target.value)})} 
                                    />
                                    
                                    <button 
                                      onClick={handleUpdateSubprocess} 
                                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 rounded-xl hover:shadow-lg transition-all hover:scale-110"
                                    >
                                      <Check size={20}/>
                                    </button>
                                    <button 
                                      onClick={() => setEditingSubprocess(null)} 
                                      className="bg-gray-200 text-gray-600 p-3 rounded-xl hover:bg-gray-300 transition-all hover:scale-110"
                                    >
                                      <X size={20}/>
                                    </button>
                                </div>
                            ) : (
                                // VISUALIZANDO SUB
                                <>
                                    <div className="flex items-center gap-4">
                                        <div className="w-2 h-14 bg-gradient-to-b from-dhl-yellow to-orange-500 rounded-full shadow-lg"></div>
                                        <div>
                                            <p className="font-black text-gray-900 text-lg">{sub.name}</p>
                                            <p className="text-xs text-gray-400 font-semibold mt-1">ID: {sub.id}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-6">
                                        <div className="text-center px-4 py-2 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-200 shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Meta UPH</p>
                                            <p className="font-black text-gray-900 text-lg">{sub.standardProductivity}</p>
                                        </div>
                                        <div className="text-center px-4 py-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Eficiência</p>
                                            <p className="font-black text-blue-600 text-lg">{(sub.efficiency * 100).toFixed(0)}%</p>
                                        </div>
                                        <div className="text-center px-4 py-2 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200 shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Desloc.</p>
                                            <p className="font-black text-orange-600 text-lg">{sub.travelTime}m</p>
                                        </div>
                                        
                                        <div className="flex gap-2 pl-6 border-l-2 border-gray-200">
                                            <button 
                                              onClick={() => setEditingSubprocess(sub)} 
                                              className="text-blue-500 hover:bg-blue-50 p-2.5 rounded-xl transition-all hover:scale-110 shadow-sm hover:shadow-md"
                                            >
                                              <Edit size={18}/>
                                            </button>
                                            <button 
                                              onClick={() => handleDeleteSubprocess(sub.id)} 
                                              className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-xl transition-all hover:scale-110 shadow-sm hover:shadow-md"
                                            >
                                              <Trash2 size={18}/>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                      ))}
                    </div>

                    {/* ADD SUBPROCESS FORM */}
                    <div className="relative bg-white p-6 rounded-2xl border-2 border-dashed border-gray-300 hover:border-dhl-yellow transition-all duration-300 group shadow-lg hover:shadow-xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-dhl-yellow/5 to-orange-400/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="relative">
                          <div className="flex items-center gap-3 mb-5 text-gray-500 group-hover:text-dhl-yellow transition-colors">
                              <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-dhl-yellow group-hover:to-orange-400 rounded-xl flex items-center justify-center transition-all shadow-md">
                                <Plus size={20} className="group-hover:text-white transition-colors" strokeWidth={3} />
                              </div>
                              <span className="font-black text-base">Adicionar Novo Subprocesso</span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-4">
                              <div className="md:col-span-2">
                                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Nome</label>
                                  <input 
                                    type="text" 
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-dhl-yellow transition-all shadow-sm hover:shadow-md" 
                                    placeholder="Ex: Conferência de Volumes" 
                                    value={newSubprocess.name} 
                                    onChange={e => setNewSubprocess({...newSubprocess, name: e.target.value})} 
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">UPH</label>
                                  <input 
                                    type="number" 
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-center outline-none focus:bg-white focus:border-dhl-yellow transition-all shadow-sm hover:shadow-md" 
                                    placeholder="0" 
                                    value={newSubprocess.standardProductivity || ''} 
                                    onChange={e => setNewSubprocess({...newSubprocess, standardProductivity: Number(e.target.value)})} 
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Efic %</label>
                                  <input 
                                    type="number" 
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-center outline-none focus:bg-white focus:border-blue-500 transition-all shadow-sm hover:shadow-md" 
                                    placeholder="100" 
                                    value={newSubprocess.efficiency} 
                                    onChange={e => setNewSubprocess({...newSubprocess, efficiency: Number(e.target.value)})} 
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Min</label>
                                  <input 
                                    type="number" 
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-center outline-none focus:bg-white focus:border-orange-500 transition-all shadow-sm hover:shadow-md" 
                                    placeholder="0" 
                                    value={newSubprocess.travelTime} 
                                    onChange={e => setNewSubprocess({...newSubprocess, travelTime: Number(e.target.value)})} 
                                  />
                              </div>
                          </div>
                          
                          <div className="flex justify-end">
                              <button 
                                onClick={() => handleCreateSubprocess(process.id)} 
                                disabled={subLoading} 
                                className="bg-gradient-to-r from-gray-900 to-black text-white font-black py-3 px-8 rounded-xl text-sm hover:shadow-2xl transition-all flex items-center gap-3 disabled:opacity-50 transform hover:scale-105 shadow-lg"
                              >
                                  {subLoading ? (
                                    <>
                                      <Loader2 className="animate-spin" size={18}/>
                                      <span>SALVANDO...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus size={18} strokeWidth={3}/>
                                      <span>SALVAR SUBPROCESSO</span>
                                    </>
                                  )}
                              </button>
                          </div>
                        </div>
                    </div>

                  </div>
                )}
              </div>
            ))}
          </div>

          {/* MODAL DE EDIÇÃO DO PAI */}
          {editingProcess && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-lg animate-fade-in-up">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border-2 border-gray-200 transform scale-100 animate-scale-in">
                <div className="relative bg-gradient-to-r from-gray-900 via-black to-gray-900 p-8 flex justify-between items-center text-white overflow-hidden">
                    <div className="absolute inset-0 shimmer-effect opacity-10"></div>
                    <div className="relative flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-dhl-yellow to-orange-500 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse-glow">
                        <Edit size={28} className="text-gray-900"/>
                      </div>
                      <div>
                        <h3 className="font-black text-2xl">Editar Processo</h3>
                        <p className="text-xs text-gray-400 mt-1">Atualize as informações necessárias</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setEditingProcess(null)} 
                      className="relative hover:bg-white/10 p-3 rounded-xl transition-all hover:scale-110 hover:rotate-90 duration-300"
                    >
                      <X size={28}/>
                    </button>
                </div>
                
                <form onSubmit={handleUpdateProcess} className="p-8 space-y-6 bg-gradient-to-br from-gray-50 to-white">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-dhl-red"></div>
                          Nome do Processo
                        </label>
                        <input 
                          type="text" 
                          className="w-full bg-white border-2 border-gray-200 rounded-xl px-5 py-4 font-bold text-gray-700 outline-none focus:bg-blue-50/30 focus:border-dhl-yellow focus:ring-4 focus:ring-yellow-50 transition-all shadow-sm hover:shadow-md" 
                          value={editingProcess.name} 
                          onChange={e => setEditingProcess({...editingProcess, name: e.target.value})} 
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-2">
                              <Zap size={12} className="text-dhl-yellow"/>
                              Meta UPH
                            </label>
                            <input 
                              type="number" 
                              className="w-full bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl px-5 py-4 font-black text-xl text-gray-800 outline-none focus:bg-white focus:border-dhl-yellow transition-all shadow-sm hover:shadow-md" 
                              value={editingProcess.standardProductivity} 
                              onChange={e => setEditingProcess({...editingProcess, standardProductivity: Number(e.target.value)})} 
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-2">
                              <Activity size={12} className="text-blue-600"/>
                              Eficiência (%)
                            </label>
                            {/* CORREÇÃO AQUI: Mostra 100, Salva 1.0 */}
                            <input 
                                type="number" 
                                className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl px-5 py-4 font-black text-xl text-blue-600 outline-none focus:bg-white focus:border-blue-500 transition-all shadow-sm hover:shadow-md" 
                                value={(editingProcess.efficiency * 100).toFixed(0)} 
                                onChange={e => setEditingProcess({...editingProcess, efficiency: Number(e.target.value) / 100})} 
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-2">
                              <Clock size={12} className="text-orange-600"/>
                              Deslocamento (min)
                            </label>
                            <input 
                              type="number" 
                              className="w-full bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl px-5 py-4 font-black text-xl text-orange-600 outline-none focus:bg-white focus:border-orange-500 transition-all shadow-sm hover:shadow-md" 
                              value={editingProcess.travelTime} 
                              onChange={e => setEditingProcess({...editingProcess, travelTime: Number(e.target.value)})} 
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-2">
                              <Warehouse size={12} className="text-purple-600"/>
                              Warehouse
                            </label>
                            <select 
                              className="w-full bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl px-5 py-4 font-black text-lg text-gray-700 outline-none focus:bg-white focus:border-purple-500 cursor-pointer transition-all shadow-sm hover:shadow-md" 
                              value={editingProcess.warehouse} 
                              onChange={e => setEditingProcess({...editingProcess, warehouse: e.target.value})}
                            >
                                <option value="M03">🏭 M03</option>
                                <option value="RC">📦 RC</option>
                            </select>
                        </div>
                    </div>
                    
                    <button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-dhl-red via-red-600 to-red-700 text-white font-black py-5 rounded-xl hover:shadow-2xl hover:scale-[1.02] transition-all text-lg tracking-wide shadow-xl"
                    >
                      💾 Salvar Alterações
                    </button>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}