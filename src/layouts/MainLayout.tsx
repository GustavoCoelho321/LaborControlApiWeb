import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/SideBar';

export function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Fixa */}
      <Sidebar />

      {/* Conteúdo Principal 
         ml-64 (margin-left: 16rem) empurra o conteúdo para não ficar embaixo da Sidebar 
      */}
      <main className="flex-1 ml-64 p-8 transition-all duration-300">
        <Outlet />
      </main>
    </div>
  );
}