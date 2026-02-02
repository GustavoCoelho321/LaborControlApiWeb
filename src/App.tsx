import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';

// --- COMPONENTES DE ESTRUTURA ---
import { Sidebar } from './components/Sidebar';

// --- IMPORTAÇÃO DAS PÁGINAS ---
import { Login } from './pages/Login';
import { Dashboard } from './pages/DashboardM03';
import { DashboardRC } from './pages/DashboardRc'; // Certifique-se que o arquivo é DashboardRC.tsx
import { ControlTower } from './pages/ControlTower'; // A página com os filtros
import { SchedulerM03 } from './pages/SchedulerM03';
import { SchedulerRC } from './pages/SchedulerRC';
import { Planning } from './pages/Planning';
import { RegisterUser } from './pages/RegisterUser';
import { RegisterProcess } from './pages/RegisterProcess';

// --- LAYOUT PROTEGIDO (Com Sidebar) ---
function PrivateLayout() {
  // Verifica autenticação
  const isAuthenticated = !!localStorage.getItem('token');

  // Se não estiver logado, manda pro login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Se estiver logado, renderiza a Sidebar e o Conteúdo da Rota (Outlet)
  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-gray-900">
      <Sidebar />
      <div className="flex-1 ml-64 transition-all duration-300">
        <div className="p-8 max-w-[1920px] mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

// --- APP PRINCIPAL ---
export function App() {
  return (
    <Router>
      <Routes>
        
        {/* ROTA PÚBLICA */}
        <Route path="/login" element={<Login />} />

        {/* ROTAS PROTEGIDAS */}
        <Route element={<PrivateLayout />}>
          
          {/* Rota Unificada (Com abas M03/RC) */}
          <Route path="/control-tower" element={<ControlTower />} />

          {/* Dashboards Individuais (Opcional, mas bom manter acessível) */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard-rc" element={<DashboardRC />} />

          {/* Simuladores */}
          <Route path="/scheduler" element={<SchedulerM03 />} />
          <Route path="/scheduler-rc" element={<SchedulerRC />} />
          
          {/* Outras Páginas */}
          <Route path="/planning" element={<Planning />} />
          <Route path="/processes" element={<RegisterProcess />} />
          <Route path="/register" element={<RegisterUser />} />
        </Route>

        {/* REDIRECIONAMENTOS */}
        
        {/* 1. Ao acessar a raiz '/', redireciona para a Control Tower */}
        <Route path="/" element={<Navigate to="/control-tower" replace />} />

        {/* 2. Qualquer rota desconhecida redireciona para o Login */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </Router>
  );
}

export default App;