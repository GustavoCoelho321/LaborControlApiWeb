import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/SideBar';
import { Header } from '../components/Header';

export function MainLayout() {
  return (
    <div className="flex min-h-screen bg-dhl-gray font-sans">
      {/* 1. Sidebar Fixa */}
      <Sidebar />

      {/* 2. Área de Conteúdo (Deslocada para a direita) */}
      <div className="flex-1 ml-64 flex flex-col">
        
        {/* Header no topo */}
        <Header />

        {/* Conteúdo Variável (Aqui entram as páginas Dashboard, Users, etc) */}
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}