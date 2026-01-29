import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { MainLayout } from './layouts/MainLayout';
import { RegisterUser } from './pages/RegisterUser';
import { RegisterProcess } from './pages/RegisterProcess';
import { Planning } from './pages/Planning'; // <--- IMPORTANTE: Importando o arquivo novo

// Placeholder apenas para Dashboard e Settings (que ainda não fizemos)
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
        {/* --- ROTA PÚBLICA --- */}
        <Route path="/" element={<Login />} />

        {/* --- ROTAS PRIVADAS --- */}
        <Route element={<MainLayout />}>
          
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* Agora aponta para o componente real importado lá em cima */}
          <Route path="/planning" element={<Planning />} />
          
          <Route path="/users" element={<RegisterUser />} />
          <Route path="/processes" element={<RegisterProcess />} />
          <Route path="/settings" element={<Settings />} />

        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;