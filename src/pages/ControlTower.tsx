import { useState } from 'react';
import { Dashboard } from './DashboardM03';
import { DashboardRC } from './DashboardRc';
import { Warehouse, Truck, LayoutGrid } from 'lucide-react';

export function ControlTower() {
  const [activeView, setActiveView] = useState<'M03' | 'RC'>('M03');

  return (
    <div className="space-y-6">
      
      {/* --- HEADER COM FILTROS --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Título Principal */}
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight flex items-center gap-3">
            <LayoutGrid size={32} className="text-gray-700" />
            Control Tower <span className="text-gray-400 font-light">| Visão Unificada</span>
          </h1>
          <p className="text-gray-500 mt-1">Selecione a operação para visualizar os indicadores em tempo real.</p>
        </div>

        {/* --- FILTROS (ABAS) --- */}
        <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2">
          
          <button
            onClick={() => setActiveView('M03')}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-all duration-300
              ${activeView === 'M03' 
                ? 'bg-dhl-red text-white shadow-md shadow-red-200 scale-105' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }
            `}
          >
            <Warehouse size={18} />
            Operação M03 (3PL)
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1"></div>

          <button
            onClick={() => setActiveView('RC')}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-all duration-300
              ${activeView === 'RC' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-105' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }
            `}
          >
            <Truck size={18} />
            Recebimento RC
          </button>

        </div>
      </div>

      {/* --- ÁREA DE CONTEÚDO --- */}
      <div className="animate-fade-in-up">
        {activeView === 'M03' ? (
          <Dashboard />
        ) : (
          <DashboardRC />
        )}
      </div>

      {/* Estilo para animação de troca suave */}
      <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
}