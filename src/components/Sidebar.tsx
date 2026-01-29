import { 
  BarChart3, 
  Settings, 
  LogOut, 
  ChevronRight, 
  CalendarClock, 
  FileText, 
  UserPlus,
  LayoutDashboard
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import dhlLogo from '../assets/Dhl_Logo.png';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    if(window.confirm("Deseja realmente sair do sistema?")) {
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <style>{`
        @keyframes slide-in-left {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fade-in-stagger {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shine {
          from {
            left: -100%;
          }
          to {
            left: 100%;
          }
        }

        .animate-slide-in-left {
          animation: slide-in-left 0.4s ease-out;
        }

        .animate-fade-in-stagger {
          animation: fade-in-stagger 0.4s ease-out backwards;
        }

        .nav-item-1 { animation-delay: 0.05s; }
        .nav-item-2 { animation-delay: 0.1s; }
        .nav-item-3 { animation-delay: 0.15s; }
        .nav-item-4 { animation-delay: 0.2s; }
        .nav-item-5 { animation-delay: 0.25s; }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .shine-effect {
          position: relative;
          overflow: hidden;
        }

        .shine-effect::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: shine 3s infinite;
        }
      `}</style>

      <aside className="w-64 bg-gradient-to-b from-white to-gray-50 h-screen fixed left-0 top-0 shadow-2xl flex flex-col z-50 border-r border-gray-200 font-sans animate-slide-in-left">
        
        {/* --- LOGO AREA (DHL HEADER) --- */}
        <div className="h-20 flex items-center justify-center bg-gradient-to-r from-[#FFCC00] to-[#FFD700] relative shadow-lg overflow-hidden shine-effect">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
          
          {/* Logo */}
          <div className="relative z-10">
            {dhlLogo ? (
              <img 
                src={dhlLogo} 
                alt="DHL Supply Chain" 
                className="h-9 object-contain drop-shadow-md hover:scale-105 transition-transform duration-300" 
              />
            ) : (
              <span className="text-[#D40511] font-black text-3xl italic drop-shadow-lg">DHL</span>
            )}
          </div>
          
          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D40511] via-[#FF0000] to-[#D40511]"></div>
        </div>

        {/* System Title */}
        <div className="px-4 py-5 border-b border-gray-200 bg-white">
          <div className="text-center">
            <h3 className="text-sm font-bold text-gray-800 tracking-wide">LABOR CONTROL</h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 flex items-center justify-center gap-1">
              <span className="w-1 h-1 bg-[#FFCC00] rounded-full"></span>
              System
              <span className="w-1 h-1 bg-[#D40511] rounded-full"></span>
            </p>
          </div>
        </div>

        {/* --- MENU --- */}
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto scrollbar-hide">
          
          {/* GRUPO OPERACIONAL */}
          <div className="animate-fade-in-stagger nav-item-1">
            <div className="flex items-center gap-2 px-2 mb-3">
              <div className="w-1 h-4 bg-gradient-to-b from-[#D40511] to-[#FF0000] rounded-full"></div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Gestão Operacional
              </p>
            </div>
            <div className="space-y-1">
              <NavItem 
                to="/" 
                icon={<LayoutDashboard size={20} />} 
                label="Control Tower" 
                active={isActive('/')}
                index={1}
              />
              <NavItem 
                to="/scheduler" 
                icon={<CalendarClock size={20} />} 
                label="Simulador Semanal" 
                active={isActive('/scheduler')}
                index={2}
              />
              <NavItem 
                to="/planning" 
                icon={<FileText size={20} />} 
                label="Planning" 
                active={isActive('/planning')}
                index={3}
              />
            </div>
          </div>

          {/* GRUPO ADMINISTRATIVO */}
          <div className="animate-fade-in-stagger nav-item-2">
            <div className="flex items-center gap-2 px-2 mb-3">
              <div className="w-1 h-4 bg-gradient-to-b from-[#FFCC00] to-[#FFD700] rounded-full"></div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Administração
              </p>
            </div>
            <div className="space-y-1">
              <NavItem 
                to="/processes" 
                icon={<Settings size={20} />} 
                label="Config. Processos" 
                active={isActive('/processes')}
                index={4}
              />
              <NavItem 
                to="/register" 
                icon={<UserPlus size={20} />} 
                label="Gestão Usuários" 
                active={isActive('/register')}
                index={5}
              />
            </div>
          </div>

          {/* Decorative divider */}
          <div className="flex items-center gap-3 px-2 opacity-50">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
            <div className="w-1.5 h-1.5 bg-[#FFCC00] rounded-full"></div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
          </div>
        </nav>

        {/* --- FOOTER --- */}
        <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-t border-gray-200 relative overflow-hidden">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 11px)`
          }}></div>
          
          {/* User Info */}
          <div className="relative z-10 flex items-center gap-3 mb-4 px-2 group cursor-pointer">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D40511] to-[#FF0000] flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-white group-hover:scale-110 transition-transform duration-300">
                AD
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
            </div>
            <div className="flex-1 overflow-hidden">
              <h4 className="text-sm font-bold text-gray-800 truncate group-hover:text-[#D40511] transition-colors">Admin User</h4>
              <p className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                <span className="w-1 h-1 bg-[#FFCC00] rounded-full"></span>
                Superintendente
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <button 
            onClick={handleLogout}
            className="group relative flex items-center justify-center gap-2 text-gray-600 hover:text-white transition-all duration-300 w-full px-4 py-3 rounded-xl font-semibold text-sm border-2 border-gray-200 hover:border-[#D40511] bg-white hover:bg-gradient-to-r hover:from-[#D40511] hover:to-[#FF0000] shadow-sm hover:shadow-lg overflow-hidden"
          >
            {/* Shine effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            
            <LogOut size={18} className="relative z-10 group-hover:rotate-12 transition-transform duration-300" />
            <span className="relative z-10">Sair do Sistema</span>
          </button>
        </div>

        {/* Bottom accent */}
        <div className="h-1 bg-gradient-to-r from-[#FFCC00] via-[#D40511] to-[#FFCC00]"></div>
      </aside>
    </>
  );
}

// Componente auxiliar de Link (NavItem)
function NavItem({ to, icon, label, active, index }: { to: string, icon: React.ReactNode, label: string, active: boolean, index: number }) {
  return (
    <Link 
      to={to} 
      className={`
        relative flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group overflow-hidden
        animate-fade-in-stagger nav-item-${index}
        ${active 
          ? 'bg-gradient-to-r from-red-50 via-red-50 to-white text-[#D40511] font-bold shadow-md ring-2 ring-red-100 scale-[1.02]' 
          : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-white hover:text-gray-900 hover:shadow-sm'
        }
      `}
    >
      {/* Indicador lateral vermelho quando ativo */}
      {active && (
        <>
          <div className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full bg-gradient-to-b from-[#D40511] to-[#FF0000] shadow-lg" />
          {/* Glow effect */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-red-100/50 to-transparent"></div>
        </>
      )}
      
      {/* Hover glow effect */}
      {!active && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#FFCC00]/0 to-[#FFCC00]/0 group-hover:from-[#FFCC00]/10 group-hover:to-transparent transition-all duration-300"></div>
      )}
      
      <div className="flex items-center gap-3 relative z-10">
        {/* Icon container with animation */}
        <div className={`
          w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300
          ${active 
            ? 'bg-gradient-to-br from-[#D40511] to-[#FF0000] text-white shadow-lg scale-110' 
            : 'bg-gray-100 group-hover:bg-gradient-to-br group-hover:from-[#FFCC00] group-hover:to-[#FFD700] group-hover:scale-110 group-hover:shadow-md'
          }
        `}>
          <span className={`transition-all duration-300 ${active ? '' : 'group-hover:scale-110'}`}>
            {icon}
          </span>
        </div>
        <span className="font-medium">{label}</span>
      </div>
      
      {/* Arrow indicator */}
      <div className={`
        relative z-10 transition-all duration-300
        ${active 
          ? 'opacity-100 translate-x-0' 
          : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
        }
      `}>
        <div className={`
          w-6 h-6 rounded-lg flex items-center justify-center
          ${active 
            ? 'bg-[#D40511]/10' 
            : 'bg-gray-100 group-hover:bg-[#FFCC00]/20'
          }
        `}>
          <ChevronRight 
            size={14} 
            className={active ? 'text-[#D40511]' : 'text-gray-400 group-hover:text-gray-600'} 
          />
        </div>
      </div>
    </Link>
  );
}