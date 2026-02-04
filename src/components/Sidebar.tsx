import { 
  Settings, 
  LogOut, 
  ChevronRight, 
  CalendarClock, 
  FileText, 
  UserPlus,
  LayoutDashboard,
  ArrowDownCircle,
  BrainCircuit
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import dhlLogo from '../assets/Dhl_Logo.png';

// --- HELPER PARA LER O JWT (ROLE + NOME) ---
function getUserData() {
  const token = localStorage.getItem('token');
  if (!token) return { role: null, name: '' };

  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const decoded = JSON.parse(jsonPayload);
    
    // Tenta pegar a role nas chaves padrões do .NET Identity ou chave simples
    const role = decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || decoded["role"] || null;
    
    // Tenta pegar o nome (unique_name ou name)
    const name = decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] || decoded["unique_name"] || decoded["name"] || "Usuário";

    return { role, name };
  } catch (error) {
    return { role: null, name: '' };
  }
}

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');

  // Carrega dados do usuário ao montar
  useEffect(() => {
    const { role, name } = getUserData();
    setIsAdmin(role === 'Admin');
    setUserName(name); // Define o nome extraído do token
  }, []);

  const handleLogout = () => {
    if(window.confirm("Deseja realmente sair do sistema?")) {
      localStorage.removeItem('token');
      localStorage.removeItem('user_data');
      navigate('/login');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // Gera as iniciais para o avatar
  const getInitials = (name: string) => {
      const parts = name.split(' ');
      if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <>
      <style>{`
        @keyframes slide-in-left { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fade-in-stagger { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shine { from { left: -100%; } to { left: 100%; } }
        .animate-slide-in-left { animation: slide-in-left 0.4s ease-out; }
        .animate-fade-in-stagger { animation: fade-in-stagger 0.4s ease-out backwards; }
        
        .nav-item-1 { animation-delay: 0.05s; }
        .nav-item-2 { animation-delay: 0.1s; }
        .nav-item-3 { animation-delay: 0.15s; }
        .nav-item-4 { animation-delay: 0.2s; }
        .nav-item-5 { animation-delay: 0.25s; }

        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .shine-effect { position: relative; overflow: hidden; }
        .shine-effect::before {
          content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: shine 3s infinite;
        }
      `}</style>

      <aside className="w-64 bg-gradient-to-b from-white to-gray-50 h-screen fixed left-0 top-0 shadow-2xl flex flex-col z-50 border-r border-gray-200 font-sans animate-slide-in-left">
        
        {/* --- HEADER --- */}
        <div className="h-20 flex items-center justify-center bg-gradient-to-r from-[#FFCC00] to-[#FFD700] relative shadow-lg overflow-hidden shine-effect">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
          <div className="relative z-10">
            {dhlLogo ? (
              <img src={dhlLogo} alt="DHL Supply Chain" className="h-9 object-contain drop-shadow-md hover:scale-105 transition-transform duration-300" />
            ) : (
              <span className="text-[#D40511] font-black text-3xl italic drop-shadow-lg">DHL</span>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D40511] via-[#FF0000] to-[#D40511]"></div>
        </div>

        <div className="px-4 py-5 border-b border-gray-200 bg-white">
          <div className="text-center">
            <h3 className="text-sm font-bold text-gray-800 tracking-wide">LABOR CONTROL</h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 flex items-center justify-center gap-1">
              <span className="w-1 h-1 bg-[#FFCC00] rounded-full"></span> System <span className="w-1 h-1 bg-[#D40511] rounded-full"></span>
            </p>
          </div>
        </div>

        {/* --- MENU --- */}
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto scrollbar-hide">
          
          {/* GRUPO OPERACIONAL (Visível para todos) */}
          <div className="animate-fade-in-stagger nav-item-1">
            <div className="flex items-center gap-2 px-2 mb-3">
              <div className="w-1 h-4 bg-gradient-to-b from-[#D40511] to-[#FF0000] rounded-full"></div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gestão Operacional</p>
            </div>
            <div className="space-y-1">
              
              <NavItem 
                to="/control-tower" 
                icon={<LayoutDashboard size={20} />} 
                label="Control Tower" 
                active={isActive('/control-tower') || isActive('/')}
                index={1}
              />

              <NavItem 
                to="/scheduler" 
                icon={<CalendarClock size={20} />} 
                label="Simulador Semanal M03" 
                active={isActive('/scheduler')}
                index={2}
              />
              
              <NavItem 
                to="/scheduler-rc" 
                icon={<ArrowDownCircle size={20} />} 
                label="Simulador Semanal RC" 
                active={isActive('/scheduler-rc')}
                index={3}
              />

              <NavItem 
                to="/planning" 
                icon={<FileText size={20} />} 
                label="Planning" 
                active={isActive('/planning')}
                index={4}
              />
            </div>
          </div>

          {/* GRUPO ADMINISTRATIVO (Só aparece se isAdmin for true) */}
          {isAdmin && (
            <div className="animate-fade-in-stagger nav-item-2 mt-6">
                <div className="flex items-center gap-2 px-2 mb-3">
                <div className="w-1 h-4 bg-gradient-to-b from-[#FFCC00] to-[#FFD700] rounded-full"></div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Administração</p>
                </div>
                <div className="space-y-1">
                <NavItem 
                    to="/processes" 
                    icon={<Settings size={20} />} 
                    label="Config. Processos" 
                    active={isActive('/processes')}
                    index={5}
                />
                <NavItem 
                    to="/register" 
                    icon={<UserPlus size={20} />} 
                    label="Gestão Usuários" 
                    active={isActive('/register')}
                    index={6}
                />
                </div>
            </div>
          )}

          <div className="flex items-center gap-3 px-2 opacity-50 mt-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
            <div className="w-1.5 h-1.5 bg-[#FFCC00] rounded-full"></div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
          </div>
        </nav>

        {/* --- FOOTER --- */}
        <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-t border-gray-200 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 11px)`}}></div>
          
          {/* --- BADGE ML IA (CLEAN VERSION) --- */}
          <div className="mb-4 flex justify-center">
            <div className="bg-purple-50 border border-purple-100 rounded-lg py-1.5 px-3 flex items-center justify-center gap-2 shadow-sm w-full">
                <BrainCircuit size={14} className="text-purple-500" />
                <span className="text-[10px] font-semibold text-purple-900 tracking-wide">
                    Powered by <span className="font-black text-purple-600">ML IA</span>
                </span>
            </div>
          </div>
          {/* --------------------------------------- */}

          <div className="relative z-10 flex items-center gap-3 mb-4 px-1 group cursor-pointer">
            <div className="relative">
              {/* Avatar com as iniciais do Nome */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D40511] to-[#FF0000] flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-white group-hover:scale-110 transition-transform duration-300 text-xs">
                {getInitials(userName)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              {/* Nome do Usuário Real */}
              <h4 className="text-sm font-bold text-gray-800 truncate group-hover:text-[#D40511] transition-colors capitalize">
                  {userName.toLowerCase()}
              </h4>
              
              {/* Cargo baseado na Role */}
              <p className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                <span className="w-1 h-1 bg-[#FFCC00] rounded-full"></span> 
                {isAdmin ? 'Superintendente' : 'Operacional'}
              </p>
            </div>
          </div>

          <button onClick={handleLogout} className="group relative flex items-center justify-center gap-2 text-gray-600 hover:text-white transition-all duration-300 w-full px-4 py-3 rounded-xl font-semibold text-sm border-2 border-gray-200 hover:border-[#D40511] bg-white hover:bg-gradient-to-r hover:from-[#D40511] hover:to-[#FF0000] shadow-sm hover:shadow-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <LogOut size={18} className="relative z-10 group-hover:rotate-12 transition-transform duration-300" />
            <span className="relative z-10">Sair do Sistema</span>
          </button>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#FFCC00] via-[#D40511] to-[#FFCC00]"></div>
      </aside>
    </>
  );
}

function NavItem({ to, icon, label, active, index }: { to: string, icon: React.ReactNode, label: string, active: boolean, index: number }) {
  return (
    <Link 
      to={to} 
      className={`relative flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group overflow-hidden animate-fade-in-stagger nav-item-${index} ${active ? 'bg-gradient-to-r from-red-50 via-red-50 to-white text-[#D40511] font-bold shadow-md ring-2 ring-red-100 scale-[1.02]' : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-white hover:text-gray-900 hover:shadow-sm'}`}
    >
      {active && (
        <>
          <div className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full bg-gradient-to-b from-[#D40511] to-[#FF0000] shadow-lg" />
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-red-100/50 to-transparent"></div>
        </>
      )}
      {!active && <div className="absolute inset-0 bg-gradient-to-r from-[#FFCC00]/0 to-[#FFCC00]/0 group-hover:from-[#FFCC00]/10 group-hover:to-transparent transition-all duration-300"></div>}
      
      <div className="flex items-center gap-3 relative z-10">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${active ? 'bg-gradient-to-br from-[#D40511] to-[#FF0000] text-white shadow-lg scale-110' : 'bg-gray-100 group-hover:bg-gradient-to-br group-hover:from-[#FFCC00] group-hover:to-[#FFD700] group-hover:scale-110 group-hover:shadow-md'}`}>
          <span className={`transition-all duration-300 ${active ? '' : 'group-hover:scale-110'}`}>{icon}</span>
        </div>
        <span className="font-medium">{label}</span>
      </div>
      
      <div className={`relative z-10 transition-all duration-300 ${active ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}>
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${active ? 'bg-[#D40511]/10' : 'bg-gray-100 group-hover:bg-[#FFCC00]/20'}`}>
          <ChevronRight size={14} className={active ? 'text-[#D40511]' : 'text-gray-400 group-hover:text-gray-600'} />
        </div>
      </div>
    </Link>
  );
}