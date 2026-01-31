import { useState, useEffect } from 'react';
import { api } from '../Services/api';
import { Save, Trash2, UserPlus, Shield, CheckCircle, AlertTriangle, Users, Lock, Edit, X, Search, Zap } from 'lucide-react';

// Interface para tipar os dados que vêm do banco
interface User {
  id: number;
  username: string;
  role: string;
}

export function RegisterUser() {
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'Viewer' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para controlar qual usuário está sendo editado (null = modo criação)
  const [editingId, setEditingId] = useState<number | null>(null);

  // Carrega a lista de usuários ao abrir a tela
  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error("Erro ao carregar usuários", error);
    }
  }

  // Filtra usuários com base na busca
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.toString().includes(searchTerm)
  );

  // Preenche o formulário com os dados do usuário para edição
  const handleEdit = (user: User) => {
    setFormData({ 
      username: user.username, 
      password: '', 
      role: user.role 
    });
    setEditingId(user.id);
    setMessage({ type: '', text: '' });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cancela a edição e limpa o formulário
  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ username: '', password: '', role: 'Viewer' });
    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (editingId) {
        const payload: any = { ...formData };
        if (!payload.password) delete payload.password;

        await api.put(`/users/${editingId}`, payload);
        setMessage({ type: 'success', text: 'Usuário atualizado com sucesso!' });
        setEditingId(null);
      } else {
        await api.post('/users', formData);
        setMessage({ type: 'success', text: 'Usuário cadastrado com sucesso!' });
      }
      
      setFormData({ username: '', password: '', role: 'Viewer' });
      loadUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data || 'Erro ao salvar usuário.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      await api.delete(`/users/${id}`);
      if (editingId === id) handleCancelEdit();
      loadUsers();
    } catch (error) {
      alert('Erro ao excluir usuário.');
    }
  };

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

        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
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
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
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

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-fadeInLeft {
          animation: fadeInLeft 0.6s ease-out;
        }

        .animate-fadeInRight {
          animation: fadeInRight 0.6s ease-out;
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }

        .animate-scaleIn {
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

        .table-row {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .table-row:hover {
          transform: scale(1.01);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .badge-shine {
          position: relative;
          overflow: hidden;
        }

        .badge-shine::after {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          bottom: -50%;
          left: -50%;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0));
          transform: rotateZ(60deg) translate(-5em, 7.5em);
        }

        .badge-shine:hover::after {
          animation: shine 0.8s;
        }

        @keyframes shine {
          to {
            transform: rotateZ(60deg) translate(1em, -9em);
          }
        }

        .gradient-border {
          position: relative;
          background: white;
        }

        .gradient-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 2px;
          background: linear-gradient(135deg, #d40511, #ffc107);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* HEADER PRINCIPAL */}
          <div className="animate-fadeInUp">
            <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              {/* Fundo decorativo com gradiente */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-dhl-red/5 to-dhl-yellow/5 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-dhl-yellow/5 to-dhl-red/5 rounded-full blur-3xl"></div>
              
              <div className="relative p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-dhl-red to-red-600 rounded-2xl blur opacity-50"></div>
                      <div className="relative w-16 h-16 bg-gradient-to-br from-dhl-red to-red-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300">
                        <Users className="text-white" size={32} />
                      </div>
                    </div>
                    <div>
                      <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                        Gestão de Usuários
                      </h1>
                      <p className="text-gray-500 mt-1 flex items-center gap-2">
                        <Zap size={14} className="text-dhl-yellow" />
                        <span>Controle total de acessos ao sistema</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="hidden md:block">
                    <div className="relative bg-gradient-to-br from-dhl-red to-red-600 rounded-2xl p-6 shadow-xl">
                      <div className="absolute inset-0 shimmer rounded-2xl"></div>
                      <div className="relative text-center">
                        <p className="text-white/80 text-sm font-medium mb-1">Total de Usuários</p>
                        <p className="text-white text-4xl font-bold">{users.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* FORMULÁRIO */}
            <div className="lg:col-span-1 animate-fadeInLeft">
              <div className={`relative bg-white rounded-2xl shadow-xl border-2 overflow-hidden card-hover transition-all duration-300 ${
                editingId ? 'border-dhl-yellow' : 'border-transparent'
              }`}>
                
                {/* Header do Card com Gradiente Animado */}
                <div className={`relative p-6 overflow-hidden ${
                  editingId 
                    ? 'bg-gradient-to-br from-dhl-yellow via-yellow-400 to-yellow-500' 
                    : 'bg-gradient-to-br from-dhl-red via-red-600 to-red-700'
                }`}>
                  {/* Elementos decorativos de fundo */}
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16"></div>
                  <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg transform hover:rotate-12 transition-transform duration-300">
                          {editingId ? <Edit className="text-white" size={22} /> : <UserPlus className="text-white" size={22} />}
                        </div>
                        <div>
                          <h2 className="font-bold text-2xl text-white drop-shadow-lg">
                            {editingId ? 'Editar Usuário' : 'Novo Usuário'}
                          </h2>
                          <p className="text-white/90 text-sm mt-0.5">
                            {editingId ? 'Atualize as informações' : 'Preencha os campos'}
                          </p>
                        </div>
                      </div>
                      {editingId && (
                        <button 
                          onClick={handleCancelEdit}
                          className="bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-xl transition-all duration-300 hover:rotate-90 backdrop-blur-sm"
                          title="Cancelar Edição"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {message.text && (
                    <div className={`animate-slideIn p-4 rounded-xl mb-5 text-sm font-medium flex items-center gap-3 border-2 ${
                      message.type === 'success' 
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-300' 
                        : 'bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-300'
                    }`}>
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                        message.type === 'success' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                      </div>
                      <span className="flex-1">{message.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    
                    {/* Username Input */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Users size={16} className={editingId ? 'text-dhl-yellow' : 'text-dhl-red'} />
                        Username
                      </label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ex: joao.silva"
                        className={`input-focus w-full px-4 py-3.5 border-2 rounded-xl outline-none bg-gray-50 font-medium transition-all duration-300 hover:border-gray-300 focus:bg-white ${
                          editingId 
                            ? 'border-gray-200 focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/20' 
                            : 'border-gray-200 focus:border-dhl-red focus:ring-4 focus:ring-dhl-red/20'
                        }`}
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                      />
                    </div>

                    {/* Password Input */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Lock size={16} className={editingId ? 'text-dhl-yellow' : 'text-dhl-red'} />
                        {editingId ? 'Nova Senha (Opcional)' : 'Senha'}
                      </label>
                      <input 
                        type="password" 
                        required={!editingId}
                        placeholder={editingId ? "Deixe em branco para manter" : "••••••••"}
                        className={`input-focus w-full px-4 py-3.5 border-2 rounded-xl outline-none bg-gray-50 font-medium transition-all duration-300 hover:border-gray-300 focus:bg-white ${
                          editingId 
                            ? 'border-gray-200 focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/20' 
                            : 'border-gray-200 focus:border-dhl-red focus:ring-4 focus:ring-dhl-red/20'
                        }`}
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                      />
                    </div>

                    {/* Role Select */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Shield size={16} className={editingId ? 'text-dhl-yellow' : 'text-dhl-red'} />
                        Permissão
                      </label>
                      <select 
                        className={`input-focus w-full px-4 py-3.5 border-2 rounded-xl outline-none bg-gray-50 appearance-none cursor-pointer font-medium transition-all duration-300 hover:border-gray-300 focus:bg-white ${
                          editingId 
                            ? 'border-gray-200 focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/20' 
                            : 'border-gray-200 focus:border-dhl-red focus:ring-4 focus:ring-dhl-red/20'
                        }`}
                        value={formData.role}
                        onChange={e => setFormData({...formData, role: e.target.value})}
                      >
                        <option value="Viewer">👁️ Viewer - Apenas Visualiza</option>
                        <option value="Planejamento">📊 Planejamento - Edita Metas</option>
                        <option value="Admin">🔐 Admin - Acesso Total</option>
                      </select>
                    </div>

                    {/* Submit Button */}
                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className={`btn-hover w-full text-white py-4 rounded-xl font-bold transition-all duration-300 shadow-lg hover:shadow-2xl flex items-center justify-center gap-3 mt-8 disabled:opacity-50 disabled:cursor-not-allowed ${
                        editingId 
                          ? 'bg-gradient-to-r from-dhl-yellow to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900' 
                          : 'bg-gradient-to-r from-dhl-red to-red-600 hover:from-red-600 hover:to-red-700'
                      }`}
                    >
                      <span className="relative z-10 flex items-center gap-3">
                        {editingId ? <Save size={22} /> : <UserPlus size={22} />}
                        {isLoading ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Cadastrar Usuário')}
                      </span>
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* LISTA DE USUÁRIOS */}
            <div className="lg:col-span-2 animate-fadeInRight">
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                
                {/* Header com Busca */}
                <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-bold text-2xl text-gray-900">Usuários Cadastrados</h3>
                      <p className="text-sm text-gray-500 mt-1">Gerencie todos os acessos</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200">
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-bold text-gray-700">{filteredUsers.length} ativo{filteredUsers.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Barra de Pesquisa */}
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-dhl-red transition-colors duration-300" size={20} />
                    <input 
                      type="text"
                      placeholder="Buscar por nome, permissão ou ID..."
                      className="w-full pl-12 pr-12 py-4 border-2 border-gray-200 rounded-xl outline-none focus:border-dhl-red focus:ring-4 focus:ring-dhl-red/10 transition-all duration-300 bg-white hover:border-gray-300 font-medium"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-all duration-300"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Tabela */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 bg-gradient-to-b from-dhl-red to-dhl-yellow rounded-full"></div>
                            ID
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Usuário</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Permissão</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center gap-4 animate-fadeInUp">
                              <div className="relative">
                                <div className="absolute inset-0 bg-gray-200 rounded-full blur-xl opacity-50"></div>
                                <div className="relative w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                                  {searchTerm ? <Search className="text-gray-400" size={32} /> : <Users className="text-gray-400" size={32} />}
                                </div>
                              </div>
                              <div>
                                <p className="text-gray-600 font-semibold text-lg">
                                  {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum usuário cadastrado'}
                                </p>
                                <p className="text-gray-400 text-sm mt-1">
                                  {searchTerm ? 'Tente ajustar sua busca' : 'Comece cadastrando o primeiro usuário'}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user, index) => (
                          <tr 
                            key={user.id} 
                            className={`table-row bg-white hover:bg-gray-50 transition-all duration-200 ${
                              editingId === user.id ? 'bg-yellow-50 border-l-4 border-dhl-yellow' : ''
                            }`}
                            style={{ 
                              animation: `fadeInUp 0.4s ease-out ${index * 0.05}s both`
                            }}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-dhl-yellow to-yellow-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg transform hover:scale-110 transition-transform duration-300">
                                  {user.id}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-inner">
                                  <Users className="text-gray-600" size={20} />
                                </div>
                                <span className={`font-bold text-base ${
                                  editingId === user.id ? 'text-dhl-red' : 'text-gray-900'
                                }`}>
                                  {user.username}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`badge-shine inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-md border-2 ${
                                user.role === 'Admin' 
                                  ? 'bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-red-200' : 
                                  user.role === 'Planejamento' 
                                  ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-700 border-yellow-200' : 
                                  'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border-gray-200'
                              }`}>
                                <Shield size={14} />
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleEdit(user)}
                                  className="group relative inline-flex items-center justify-center w-10 h-10 text-blue-600 hover:text-white transition-all duration-300 rounded-xl overflow-hidden shadow-sm hover:shadow-lg"
                                  title="Editar Usuário"
                                >
                                  <div className="absolute inset-0 bg-blue-600 transform scale-0 group-hover:scale-100 transition-transform duration-300 rounded-xl"></div>
                                  <Edit size={18} className="relative z-10" />
                                </button>
                                
                                <button 
                                  onClick={() => handleDelete(user.id)}
                                  className="group relative inline-flex items-center justify-center w-10 h-10 text-gray-400 hover:text-white transition-all duration-300 rounded-xl overflow-hidden shadow-sm hover:shadow-lg"
                                  title="Excluir Usuário"
                                >
                                  <div className="absolute inset-0 bg-red-500 transform scale-0 group-hover:scale-100 transition-transform duration-300 rounded-xl"></div>
                                  <Trash2 size={18} className="relative z-10" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                {filteredUsers.length > 0 && (
                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">
                        {searchTerm 
                          ? `Exibindo ${filteredUsers.length} de ${users.length} usuário(s)`
                          : `Total de ${users.length} usuário(s) cadastrado(s)`
                        }
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-dhl-yellow rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-dhl-red rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-dhl-yellow rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}