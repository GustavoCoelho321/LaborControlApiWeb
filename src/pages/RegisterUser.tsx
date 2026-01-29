import { useState, useEffect } from 'react';
import { api } from '../Services/api';
import { Save, Trash2, UserPlus, Shield, CheckCircle, AlertTriangle, Users, Lock } from 'lucide-react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // POST para criar usuário
      await api.post('/users', formData);
      
      setMessage({ type: 'success', text: 'Usuário cadastrado com sucesso!' });
      setFormData({ username: '', password: '', role: 'Viewer' }); // Limpa formulário
      loadUsers(); // Recarrega a lista
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data || 'Erro ao criar usuário. Verifique se já existe.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      await api.delete(`/users/${id}`);
      loadUsers();
    } catch (error) {
      alert('Erro ao excluir usuário.');
    }
  };

  return (
    <>
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulse-border {
          0%, 100% {
            border-color: rgba(212, 5, 17, 0.3);
          }
          50% {
            border-color: rgba(212, 5, 17, 0.6);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out;
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.5s ease-out;
        }

        .animate-pulse-border {
          animation: pulse-border 2s ease-in-out infinite;
        }

        .group:hover .group-hover-scale {
          transform: scale(1.05);
        }

        .card-hover {
          transition: all 0.3s ease;
        }

        .card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
      `}</style>

      <div className="space-y-8 animate-fade-in-up">
        
        {/* --- HEADER DA PÁGINA --- */}
        <div className="relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-dhl-red via-dhl-yellow to-dhl-red"></div>
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-dhl-red to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <UserPlus className="text-white" size={28} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                    Gestão de Usuários
                  </h1>
                  <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-dhl-yellow rounded-full"></span>
                    Cadastre e gerencie o acesso ao sistema
                  </p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-4 text-sm">
                <div className="bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  <span className="text-gray-500 font-semibold">Total de Usuários:</span>
                  <span className="ml-2 text-dhl-red font-bold text-lg">{users.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* --- FORMULÁRIO DE CADASTRO (Lado Esquerdo) --- */}
          <div className="lg:col-span-1 animate-fade-in-up">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden card-hover">
              
              {/* Header do Card */}
              <div className="bg-gradient-to-r from-dhl-red to-red-600 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                      <UserPlus className="text-white" size={20} />
                    </div>
                    <h2 className="font-bold text-xl text-white">Novo Usuário</h2>
                  </div>
                  <p className="text-white/80 text-sm">Preencha os dados abaixo</p>
                </div>
              </div>

              <div className="p-6">
                {message.text && (
                  <div className={`p-4 rounded-xl mb-6 text-sm flex items-center gap-3 border animate-pulse-border ${
                    message.type === 'success' 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200' 
                      : 'bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-200'
                  }`}>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.type === 'success' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    </div>
                    <span className="flex-1 font-medium">{message.text}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  
                  {/* Username Input */}
                  <div className="group">
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <Users size={16} className="text-dhl-red" />
                      Username
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        required
                        placeholder="Ex: joao.silva"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/10 outline-none transition-all duration-300 bg-gray-50 focus:bg-white hover:border-gray-300"
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                      />
                      <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-dhl-yellow to-dhl-red group-focus-within:w-full transition-all duration-500"></div>
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="group">
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <Lock size={16} className="text-dhl-red" />
                      Senha
                    </label>
                    <div className="relative">
                      <input 
                        type="password" 
                        required
                        placeholder="••••••••"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/10 outline-none transition-all duration-300 bg-gray-50 focus:bg-white hover:border-gray-300"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                      />
                      <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-dhl-yellow to-dhl-red group-focus-within:w-full transition-all duration-500"></div>
                    </div>
                  </div>

                  {/* Role Select */}
                  <div className="group">
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <Shield size={16} className="text-dhl-red" />
                      Permissão
                    </label>
                    <div className="relative">
                      <select 
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/10 outline-none bg-gray-50 focus:bg-white appearance-none cursor-pointer transition-all duration-300 hover:border-gray-300"
                        value={formData.role}
                        onChange={e => setFormData({...formData, role: e.target.value})}
                      >
                        <option value="Viewer">👁️ Viewer (Apenas Visualiza)</option>
                        <option value="Planejamento">📊 Planejamento (Edita Metas)</option>
                        <option value="Admin">🔐 Admin (Acesso Total)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-dhl-yellow to-dhl-red group-focus-within:w-full transition-all duration-500"></div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="group relative w-full bg-gradient-to-r from-dhl-red to-red-600 hover:from-red-700 hover:to-red-800 text-white py-4 rounded-xl font-bold transition-all duration-300 shadow-lg hover:shadow-2xl flex items-center justify-center gap-3 mt-6 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    <Save size={20} className="relative z-10" />
                    <span className="relative z-10">{isLoading ? 'Salvando...' : 'Cadastrar Usuário'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* --- LISTA DE USUÁRIOS (Lado Direito) --- */}
          <div className="lg:col-span-2 animate-slide-in-right">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
              
              {/* Header da Tabela */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <Users className="text-dhl-red" size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">Usuários Ativos</h3>
                      <p className="text-xs text-gray-500">Lista completa de acessos</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-semibold text-gray-600">{users.length} registros</span>
                  </div>
                </div>
              </div>
              
              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-600 uppercase bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-4 font-bold">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-dhl-red rounded"></div>
                          ID
                        </div>
                      </th>
                      <th className="px-6 py-4 font-bold">Usuário</th>
                      <th className="px-6 py-4 font-bold">Permissão</th>
                      <th className="px-6 py-4 text-right font-bold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                              <Users className="text-gray-400" size={32} />
                            </div>
                            <p className="text-gray-400 font-medium">Nenhum usuário encontrado</p>
                            <p className="text-gray-400 text-xs">Cadastre o primeiro usuário usando o formulário ao lado</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      users.map((user, index) => (
                        <tr 
                          key={user.id} 
                          className="bg-white hover:bg-gray-50 transition-all duration-200 group"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-dhl-yellow to-yellow-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                {user.id}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                <Users className="text-gray-600" size={18} />
                              </div>
                              <span className="font-semibold text-gray-800">{user.username}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm border
                              ${user.role === 'Admin' 
                                ? 'bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-red-200' : 
                                user.role === 'Planejamento' 
                                ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-700 border-yellow-200' : 
                                'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border-gray-200'}`}>
                              <Shield size={12} />
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDelete(user.id)}
                              className="inline-flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-red-500 transition-all duration-300 rounded-lg group-hover:shadow-md"
                              title="Excluir Usuário"
                            >
                              <Trash2 size={18} />
                              <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Excluir</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer da Tabela */}
              {users.length > 0 && (
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Exibindo {users.length} usuário(s)</span>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-dhl-yellow rounded-full"></div>
                      <div className="w-1.5 h-1.5 bg-dhl-red rounded-full"></div>
                      <div className="w-1.5 h-1.5 bg-dhl-yellow rounded-full"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}