import { BrowserRouter as Router, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';

// --- COMPONENTES DE ESTRUTURA ---
import { Sidebar } from './components/Sidebar';

// --- IMPORTAÇÃO DAS PÁGINAS ---
import { Login } from './pages/Login';
import { Dashboard } from './pages/DashboardM03'; // Verifique se o nome do arquivo é DashboardM03.tsx ou Dashboard.tsx
import { DashboardRC } from './pages/DashboardRc'; 
import { ControlTower } from './pages/ControlTower';
import { SchedulerM03 } from './pages/SchedulerM03';
import { SchedulerRC } from './pages/SchedulerRC';
import { Planning } from './pages/Planning';
import { RegisterUser } from './pages/RegisterUser';
import { RegisterProcess } from './pages/RegisterProcess';
import { ChangePassword } from './pages/ChangePassword';

// --- LAYOUT PROTEGIDO (Com Lógica de Bloqueio) ---
function PrivateLayout() {
  const location = useLocation();
  const isAuthenticated = !!localStorage.getItem('token');
  
  // 1. Tenta ler a flag de troca de senha do localStorage
  // Essa flag é gravada no Login.tsx e atualizada no ChangePassword.tsx
  const userDataString = localStorage.getItem('user_data');
  let mustChangePassword = false;
  
  if (userDataString) {
    try {
      const userData = JSON.parse(userDataString);
      // Lê de forma segura, ignorando Case Sensitive
      mustChangePassword = userData.mustChangePassword || userData.MustChangePassword || false;
    } catch (e) {
      console.error("Erro ao ler dados do usuário", e);
    }
  }

  // 2. Se não estiver autenticado, manda pro Login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 3. BLOQUEIO DE SEGURANÇA:
  // Se precisa trocar a senha e NÃO está na página de troca -> Força ir para lá
  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // 4. Se NÃO precisa trocar a senha, mas tenta acessar a página de troca -> Manda pro sistema
  if (!mustChangePassword && location.pathname === '/change-password') {
    return <Navigate to="/control-tower" replace />;
  }

  // 5. Layout Especial para a página de troca de senha (Sem Sidebar, centralizado)
  if (location.pathname === '/change-password') {
      return (
        <div className="flex min-h-screen bg-gray-100 font-sans text-gray-900 justify-center items-center">
           <Outlet />
        </div>
      );
  }

  // 6. Layout Padrão do Sistema (Com Sidebar)
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

        {/* ROTAS PROTEGIDAS PELA LOGICA ACIMA */}
        <Route element={<PrivateLayout />}>
          
          {/* Rota Unificada (Com abas M03/RC) */}
          <Route path="/control-tower" element={<ControlTower />} />

          {/* Dashboards Individuais */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard-rc" element={<DashboardRC />} />

          {/* Simuladores */}
          <Route path="/scheduler" element={<SchedulerM03 />} />
          <Route path="/scheduler-rc" element={<SchedulerRC />} />
          
          {/* Outras Páginas */}
          <Route path="/planning" element={<Planning />} />
          <Route path="/processes" element={<RegisterProcess />} />
          <Route path="/register" element={<RegisterUser />} />
          
          {/* Rota de Troca de Senha Obrigatória */}
          <Route path="/change-password" element={<ChangePassword />} />
        </Route>

        {/* REDIRECIONAMENTOS */}
        <Route path="/" element={<Navigate to="/control-tower" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </Router>
  );
}

export default App;