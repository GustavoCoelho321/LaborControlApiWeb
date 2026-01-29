import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Importe a Sidebar que acabamos de criar
import { Sidebar } from './components/SideBar'; // <--- Ajuste o caminho se necessário

// Importação das Páginas
import { Dashboard } from './pages/Dashboard';
import { Scheduler } from './pages/Scheduler';
import { Planning } from './pages/Planning';
import { RegisterUser } from './pages/RegisterUser';
import { RegisterProcess } from './pages/RegisterProcess';

export function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-100 font-sans text-gray-900">
        
        {/* 1. A Sidebar fica fixa aqui */}
        <Sidebar />

        {/* 2. O Conteúdo principal tem uma margem à esquerda (ml-64) para não ficar embaixo da Sidebar */}
        <div className="flex-1 ml-64 transition-all duration-300">
          <div className="p-8 max-w-[1920px] mx-auto">
            
            {/* 3. As rotas trocam apenas o conteúdo desta área */}
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/scheduler" element={<Scheduler />} />
              <Route path="/planning" element={<Planning />} />
              <Route path="/processes" element={<RegisterProcess />} />
              <Route path="/register" element={<RegisterUser />} />
              {/* Adicione rota de login se tiver: <Route path="/login" element={<Login />} /> */}
            </Routes>

          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;