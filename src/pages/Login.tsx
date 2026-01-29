import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../Services/api';
import { Lock, User, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import dhlLogo from '../assets/Dhl_Logo.png';

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
      console.log(`Tentando conectar em: ${api.defaults.baseURL}/auth/login`);
      
      const response = await api.post('/auth/login', { 
        username, 
        password 
      });

      const { token } = response.data;
      localStorage.setItem('token', token);
      navigate('/dashboard');
      
    } catch (err: any) {
      console.error("Erro detalhado:", err);

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
    <>
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        @keyframes gradient-x {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          10%, 30%, 50%, 70%, 90% {
            transform: translateX(-5px);
          }
          20%, 40%, 60%, 80% {
            transform: translateX(5px);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 relative overflow-hidden">
        
        {/* Background Animated Elements */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-dhl-yellow via-dhl-red to-dhl-yellow animate-gradient-x"></div>
        
        {/* Floating geometric shapes */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-dhl-yellow/10 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-dhl-red/10 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-20 left-1/2 w-80 h-80 bg-gray-300/20 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
        
        {/* Diagonal stripes background */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 50px,
              rgba(0,0,0,0.1) 50px,
              rgba(0,0,0,0.1) 52px
            )`
          }}></div>
        </div>

        {/* Main Card */}
        <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md relative z-20 border border-gray-200 animate-fade-in-up backdrop-blur-sm">
          
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-dhl-red via-dhl-yellow to-dhl-red rounded-t-2xl"></div>
          
          {/* Corner decoration */}
          <div className="absolute -top-3 -left-3 w-6 h-6 border-t-4 border-l-4 border-dhl-yellow rounded-tl-lg"></div>
          <div className="absolute -top-3 -right-3 w-6 h-6 border-t-4 border-r-4 border-dhl-red rounded-tr-lg"></div>
          
          {/* Logo Area */}
          <div className="text-center mb-8 relative">
            <div className="inline-block relative group">
              <div className="absolute inset-0 bg-dhl-yellow/20 blur-xl group-hover:blur-2xl transition-all duration-300 rounded-full"></div>
              <img 
                src={dhlLogo} 
                alt="DHL Logo" 
                className="h-14 mx-auto mb-4 object-contain relative z-10 transform group-hover:scale-105 transition-transform duration-300" 
              />
            </div>
            <div className="relative">
              <p className="text-gray-600 font-bold uppercase tracking-[0.3em] text-xs relative z-10">
                Labor Control System
              </p>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-0.5 bg-gradient-to-r from-transparent via-dhl-red to-transparent mt-2"></div>
            </div>
          </div>

          {/* Error Message with animation */}
          {error && (
            <div className="flex items-center gap-3 bg-gradient-to-r from-red-50 to-red-100/50 text-red-700 p-4 rounded-xl mb-6 text-sm border border-red-200 shadow-sm animate-shake">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <span className="flex-1">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Username Input */}
            <div className="group relative">
              <label className="block text-sm font-bold text-gray-700 mb-2 transition-colors group-focus-within:text-dhl-red">
                Usuário
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 h-full w-12 flex items-center justify-center text-gray-400 group-focus-within:text-dhl-yellow transition-colors z-10">
                  <User size={20} />
                </div>
                <input 
                  type="text" 
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/10 bg-gray-50 focus:bg-white transition-all duration-300 hover:border-gray-300"
                  placeholder="Ex: thiago_admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-dhl-yellow to-dhl-red group-focus-within:w-full transition-all duration-500"></div>
              </div>
            </div>

            {/* Password Input */}
            <div className="group relative">
              <label className="block text-sm font-bold text-gray-700 mb-2 transition-colors group-focus-within:text-dhl-red">
                Senha
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 h-full w-12 flex items-center justify-center text-gray-400 group-focus-within:text-dhl-yellow transition-colors z-10">
                  <Lock size={20} />
                </div>
                <input 
                  type="password" 
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-dhl-yellow focus:ring-4 focus:ring-dhl-yellow/10 bg-gray-50 focus:bg-white transition-all duration-300 hover:border-gray-300"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-dhl-yellow to-dhl-red group-focus-within:w-full transition-all duration-500"></div>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={isLoading}
              className="group relative w-full bg-gradient-to-r from-dhl-red to-red-600 hover:from-red-700 hover:to-red-800 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-2xl flex items-center justify-center gap-3 mt-6 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
            >
              {/* Button shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              
              {isLoading ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  <span className="relative z-10">Validando...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10 tracking-wide">ENTRAR</span>
                  <ArrowRight size={22} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
            <div className="w-2 h-2 bg-dhl-yellow rounded-full"></div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
          </div>

          {/* Footer */}
          <div className="text-center">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-2">
              <span className="inline-block w-1 h-1 bg-dhl-red rounded-full"></span>
              &copy; {new Date().getFullYear()} DHL Supply Chain
              <span className="inline-block w-1 h-1 bg-dhl-red rounded-full"></span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Acesso restrito</p>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-dhl-yellow via-dhl-red to-dhl-yellow opacity-50"></div>
      </div>
    </>
  );
}