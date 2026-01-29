import { BarChart3, Users, Package, Settings, LogOut, ChevronRight, Layers } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import dhlLogo from '../assets/Dhl_Logo.png'; // Garanta que a imagem está nesta pasta

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <aside className="w-64 bg-white h-screen fixed left-0 top-0 shadow-xl flex flex-col z-20 border-r border-gray-200">
      
      {/* --- LOGO AREA --- */}
      <div className="h-24 flex items-center justify-center bg-dhl-yellow shadow-sm relative">
         <img 
            src={dhlLogo} 
            alt="DHL Supply Chain" 
            className="h-10 object-contain" 
         />
      </div>

      {/* --- MENU ITENS --- */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        
        {/* Grupo Operacional */}
        <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Operacional</p>
        
        <NavItem 
          to="/dashboard" 
          icon={<BarChart3 size={20} />} 
          label="Dashboard" 
          active={location.pathname === '/dashboard'} 
        />
        <NavItem 
          to="/planning" 
          icon={<Package size={20} />} 
          label="Planejamento" 
          active={location.pathname === '/planning'} 
        />

        {/* Grupo Administrativo */}
        <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-6">Administração</p>
        
        <NavItem 
          to="/processes" 
          icon={<Layers size={20} />} 
          label="Processos" 
          active={location.pathname === '/processes'} 
        />
        <NavItem 
          to="/users" 
          icon={<Users size={20} />} 
          label="Usuários" 
          active={location.pathname === '/users'} 
        />
        <NavItem 
          to="/settings" 
          icon={<Settings size={20} />} 
          label="Configurações" 
          active={location.pathname === '/settings'} 
        />
      </nav>

      {/* --- FOOTER (Logout) --- */}
      <div className="p-4 border-t border-gray-100 bg-gray-50">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 text-gray-600 hover:text-dhl-red hover:bg-red-50 transition-all w-full px-4 py-3 rounded-lg font-medium group"
        >
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

// Componente auxiliar para padronizar os links
function NavItem({ to, icon, label, active }: { to: string, icon: React.ReactNode, label: string, active: boolean }) {
  return (
    <Link 
      to={to} 
      className={`
        flex items-center justify-between px-4 py-3 rounded-lg transition-all font-medium mb-1
        ${active 
          ? 'bg-gradient-to-r from-dhl-yellow to-yellow-300 text-dhl-red shadow-sm' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-dhl-red'
        }
      `}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      {active && <ChevronRight size={16} className="text-dhl-red" />}
    </Link>
  );
}