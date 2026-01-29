import { UserCircle, Bell } from 'lucide-react';

export function Header() {
  // Simulação de usuário (depois pegaremos do Token real)
  const username = "Admin User";

  return (
    <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm">
      
      {/* Lado Esquerdo: Título ou Breadcrumb */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">Visão Geral</h2>
        <p className="text-sm text-gray-500">Bem-vindo ao painel de controle</p>
      </div>

      {/* Lado Direito: Perfil e Notificações */}
      <div className="flex items-center gap-6">
        <button className="relative p-2 text-gray-400 hover:text-dhl-red transition-colors">
          <Bell size={22} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-dhl-red rounded-full"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-gray-700">{username}</p>
            <p className="text-xs text-gray-500">Gestor Operacional</p>
          </div>
          <div className="w-10 h-10 bg-dhl-yellow/20 rounded-full flex items-center justify-center text-dhl-red border border-dhl-yellow">
            <UserCircle size={28} />
          </div>
        </div>
      </div>
    </header>
  );
}