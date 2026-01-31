import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';

// --- COMPONENTES DE ESTRUTURA ---
import { Sidebar } from './components/Sidebar';

// --- IMPORTAÇÃO DAS PÁGINAS ---
import { Login } from './pages/Login'; // <--- Nova importação
import { Dashboard } from './pages/Dashboard';
import { SchedulerM03 } from './pages/SchedulerM03';
import { Planning } from './pages/Planning';
import { RegisterUser } from './pages/RegisterUser';
import { RegisterProcess } from './pages/RegisterProcess';

// --- LAYOUT PROTEGIDO (Com Sidebar) ---
// Este componente serve de "casca" para todas as páginas internas
function PrivateLayout() {
  // Verificação simples de autenticação (pode ser melhorada com Context API depois)
  const isAuthenticated = !!localStorage.getItem('token');

  // Se não estiver logado, chuta para o login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-gray-900">
      {/* Sidebar Fixa */}
      <Sidebar />

      {/* Área de Conteúdo (com margem para não ficar embaixo da sidebar) */}
      <div className="flex-1 ml-64 transition-all duration-300">
        <div className="p-8 max-w-[1920px] mx-auto">
          {/* O <Outlet /> renderiza a rota filha atual (Dashboard, Scheduler, etc.) */}
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
        
        {/* ROTA PÚBLICA (Sem Sidebar) */}
        <Route path="/login" element={<Login />} />

        {/* ROTAS PROTEGIDAS (Com Sidebar) */}
        <Route element={<PrivateLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scheduler" element={<SchedulerM03 />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/processes" element={<RegisterProcess />} />
          <Route path="/register" element={<RegisterUser />} />
        </Route>

        {/* Rota de Catch-all (Redireciona qualquer url errada para o home/login) */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}

export default App;