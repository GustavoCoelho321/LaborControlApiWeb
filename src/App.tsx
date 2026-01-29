import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { MainLayout } from './layouts/MainLayout';
import { RegisterUser } from './pages/RegisterUser';
import { RegisterProcess } from './pages/RegisterProcess';
import { Planning } from './pages/Planning';
import { Scheduler } from './pages/Scheduler'; // <--- IMPORTANTE: Importei a nova tela aqui

// Placeholder para telas que ainda não fizemos (Dashboard e Settings)
const Dashboard = () => (
  <div className="p-4">
    <h1 className="text-2xl font-bold text-gray-800">Dashboard Operacional</h1>
    <p className="text-gray-500">Gráficos e indicadores serão implementados aqui.</p>
  </div>
);

const Settings = () => (
  <div className="p-4">
    <h1 className="text-2xl font-bold text-gray-800">Configurações Gerais</h1>
    <p className="text-gray-500">Parâmetros do sistema.</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* --- ROTA PÚBLICA (Login) --- */}
        <Route path="/" element={<Login />} />

        {/* --- ROTAS PRIVADAS (Com Sidebar e Header) --- */}
        <Route element={<MainLayout />}>
          
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* Telas Operacionais */}
          <Route path="/planning" element={<Planning />} />
          <Route path="/scheduler" element={<Scheduler />} /> {/* <--- NOVA ROTA REGISTRADA */}
          
          {/* Telas Administrativas */}
          <Route path="/users" element={<RegisterUser />} />
          <Route path="/processes" element={<RegisterProcess />} />
          <Route path="/settings" element={<Settings />} />

        </Route>

        {/* Redireciona qualquer rota inválida para o login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;