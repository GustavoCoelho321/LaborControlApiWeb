import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../Services/api';
import { Lock, User, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import dhlLogo from '../assets/Dhl_Logo.png'; // Importação do Logo

export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log(`Tentando conectar em: ${api.defaults.baseURL}/auth/login`); // Debug para te ajudar
      
      const response = await api.post('/auth/login', { 
        username, 
        password 
      });

      const { token } = response.data;
      localStorage.setItem('token', token);
      navigate('/dashboard');
      
    } catch (err: any) {
      console.error("Erro detalhado:", err); // Abra o Console do navegador (F12) para ver isso

      if (err.code === "ERR_NETWORK") {
        setError('Erro de Conexão: O Backend está desligado ou bloqueando o acesso (CORS).');
      } else if (err.response?.status === 401) {
        setError('Usuário ou senha incorretos.');
      } else {
        setError('Erro ao tentar entrar. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative overflow-hidden">
      
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-3 bg-dhl-yellow z-10"></div>
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-gray-200 to-transparent"></div>
      
      <div className="bg-white p-10 rounded-xl shadow-2xl w-full max-w-md relative z-20 border-t-4 border-dhl-red animate-fade-in-up">
        
        {/* LOGO AREA - Agora com imagem real */}
        <div className="text-center mb-8">
          <img 
            src={dhlLogo} 
            alt="DHL Logo" 
            className="h-12 mx-auto mb-4 object-contain" // Ajuste o h-12 se ficar muito pequeno/grande
          />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Labor Control System</p>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm border border-red-100">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-1">Usuário</label>
            <div className="relative">
              <div className="absolute left-0 top-0 h-full w-10 flex items-center justify-center text-gray-400">
                <User size={20} />
              </div>
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-dhl-yellow bg-gray-50 focus:bg-white transition-all"
                placeholder="Ex: thiago_admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <div className="absolute left-0 top-0 h-full w-10 flex items-center justify-center text-gray-400">
                <Lock size={20} />
              </div>
              <input 
                type="password" 
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-dhl-yellow bg-gray-50 focus:bg-white transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-dhl-red hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Validando...</span>
              </>
            ) : (
              <>
                <span>ENTRAR</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} DHL Supply Chain. Acesso restrito.
          </p>
        </div>
      </div>
    </div>
  );
}