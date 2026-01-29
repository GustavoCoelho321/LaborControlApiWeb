import { BarChart3, Users, Package, Settings, LogOut, ChevronRight, Layers, UserCircle2, CalendarClock } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import dhlLogo from '../assets/Dhl_Logo.png'; 

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    if(window.confirm("Deseja realmente sair do sistema?")) {
      localStorage.removeItem('token');
      navigate('/');
    }
  };

  return (
    <aside className="w-64 bg-white h-screen fixed left-0 top-0 shadow-2xl flex flex-col z-50 transition-all duration-300 border-r border-gray-100 font-sans">
      
      {/* --- LOGO AREA --- */}
      <div className="h-20 flex items-center justify-center bg-gradient-to-br from-dhl-yellow to-yellow-400 relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full bg-white/10 skew-x-12 translate-x-10"></div>
         <img 
            src={dhlLogo} 
            alt="DHL Supply Chain" 
            className="h-8 object-contain relative z-10 drop-shadow-sm transform hover:scale-105 transition-transform duration-300" 
         />
      </div>

      {/* --- MENU --- */}
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto scrollbar-hide">
        
        {/* GRUPO OPERACIONAL (AQUI QUE MUDOU) */}
        <div className="mb-6">
          <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Operacional</p>
          <div className="space-y-1">
            <NavItem to="/dashboard" icon={<BarChart3 size={18} />} label="Dashboard" active={location.pathname === '/dashboard'} />
            <NavItem to="/planning" icon={<Package size={18} />} label="Planejamento" active={location.pathname === '/planning'} />
            {/* NOVO LINK ADICIONADO AQUI: */}
            <NavItem to="/scheduler" icon={<CalendarClock size={18} />} label="Gestão Hora a Hora" active={location.pathname === '/scheduler'} />
          </div>
        </div>

        {/* Grupo Administrativo */}
        <div>
          <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Administração</p>
          <div className="space-y-1">
            <NavItem to="/processes" icon={<Layers size={18} />} label="Processos" active={location.pathname === '/processes'} />
            <NavItem to="/users" icon={<Users size={18} />} label="Usuários" active={location.pathname === '/users'} />
            <NavItem to="/settings" icon={<Settings size={18} />} label="Configurações" active={location.pathname === '/settings'} />
          </div>
        </div>
      </nav>

      {/* --- FOOTER --- */}
      <div className="p-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-dhl-red/10 flex items-center justify-center text-dhl-red">
            <UserCircle2 size={20} />
          </div>
          <div className="flex-1 overflow-hidden">
            <h4 className="text-xs font-bold text-gray-800 truncate">Admin</h4>
            <p className="text-[10px] text-gray-500 truncate">admin@dhl.com</p>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 text-gray-500 hover:text-white hover:bg-dhl-red transition-all duration-300 w-full px-4 py-2 rounded-lg font-medium text-xs group shadow-sm"
        >
          <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

function NavItem({ to, icon, label, active }: { to: string, icon: React.ReactNode, label: string, active: boolean }) {
  return (
    <Link 
      to={to} 
      className={`
        relative flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group overflow-hidden
        ${active ? 'bg-yellow-50 text-dhl-red font-bold shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
      `}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-dhl-red transition-all duration-300 ${active ? 'opacity-100' : 'opacity-0 -translate-x-full'}`} />
      <div className="flex items-center gap-3 relative z-10">
        <span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
        <span className={`text-sm transition-transform duration-300 ${!active && 'group-hover:translate-x-1'}`}>{label}</span>
      </div>
      {active && <ChevronRight size={14} className="text-dhl-red animate-fade-in" />}
    </Link>
  );
}