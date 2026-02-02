import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';

// --- COMPONENTES DE ESTRUTURA ---
import { Sidebar } from './components/Sidebar';

// --- IMPORTAÇÃO DAS PÁGINAS ---
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SchedulerM03 } from './pages/SchedulerM03';
import { Planning } from './pages/Planning';
import { RegisterUser } from './pages/RegisterUser';
import { RegisterProcess } from './pages/RegisterProcess';
import { SchedulerRC } from './pages/SchedulerRC';

// --- LAYOUT PROTEGIDO (Com Sidebar) ---
function PrivateLayout() {
  const isAuthenticated = !!localStorage.getItem('token');

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scheduler" element={<SchedulerM03 />} />
          <Route path="/scheduler-rc" element={<SchedulerRC />} /> {/* <--- NOVA ROTA */}
          <Route path="/planning" element={<Planning />} />
          <Route path="/processes" element={<RegisterProcess />} />
          <Route path="/register" element={<RegisterUser />} />
        </Route>        
        {/* 1. Se o usuário acessar a raiz '/', tenta ir pro Dashboard. 
               Se não tiver logado, o PrivateLayout vai chutar pro Login. 
               Se tiver logado, ele vê o Dashboard. Melhor UX. */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* 2. Se acessar qualquer rota doida, manda pro Login (ou Dashboard) */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </Router>
  );
}

export default App;