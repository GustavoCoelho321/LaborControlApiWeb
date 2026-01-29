import { useState, useEffect } from 'react';
import { api } from '../Services/api';
import { Save, Trash2, UserPlus, Shield, CheckCircle, AlertTriangle } from 'lucide-react';

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
    <div className="space-y-8 animate-fade-in-up">
      {/* --- HEADER DA PÁGINA --- */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UserPlus className="text-dhl-red" />
            Gestão de Usuários
          </h1>
          <p className="text-gray-500 text-sm mt-1">Cadastre e gerencie o acesso ao sistema.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- FORMULÁRIO DE CADASTRO (Lado Esquerdo) --- */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-dhl-yellow">
            <h2 className="font-bold text-lg mb-4 text-gray-700">Novo Usuário</h2>
            
            {message.text && (
              <div className={`p-3 rounded mb-4 text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: joao.silva"
                  className="w-full p-2 border border-gray-300 rounded focus:border-dhl-red focus:ring-1 focus:ring-dhl-red outline-none transition-colors"
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Senha</label>
                <input 
                  type="password" 
                  required
                  placeholder="******"
                  className="w-full p-2 border border-gray-300 rounded focus:border-dhl-red focus:ring-1 focus:ring-dhl-red outline-none transition-colors"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Permissão</label>
                <div className="relative">
                  <Shield className="absolute left-2 top-2.5 text-gray-400" size={16} />
                  <select 
                    className="w-full pl-8 p-2 border border-gray-300 rounded focus:border-dhl-red focus:ring-1 focus:ring-dhl-red outline-none bg-white"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="Viewer">Viewer (Apenas Visualiza)</option>
                    <option value="Planejamento">Planejamento (Edita Metas)</option>
                    <option value="Admin">Admin (Acesso Total)</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-dhl-red text-white py-2 rounded font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 mt-2 shadow-sm"
              >
                <Save size={18} />
                {isLoading ? 'Salvando...' : 'Cadastrar'}
              </button>
            </form>
          </div>
        </div>

        {/* --- LISTA DE USUÁRIOS (Lado Direito) --- */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-700">Usuários Ativos</h3>
            </div>
            
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Usuário</th>
                  <th className="px-6 py-3">Permissão</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{user.id}</td>
                      <td className="px-6 py-4">{user.username}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold 
                          ${user.role === 'Admin' ? 'bg-red-100 text-red-800' : 
                            user.role === 'Planejamento' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-gray-100 text-gray-800'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDelete(user.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1"
                          title="Excluir Usuário"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}