# 💻 Labor Control Web App

**Versão:** 1.0.0  
**Stack:** React 18, Vite, Tailwind CSS, TypeScript  
**Tipo:** Single Page Application (SPA)

---

## 1. Visão Geral

O **Labor Control Web** é a interface de usuário do sistema de WFM (Workforce Management). Ele fornece painéis interativos, simuladores de escala e ferramentas administrativas para gestão operacional.

O sistema consome a **Labor Control API** (.NET) e foca em performance, usabilidade e visualização de dados em tempo real.

---

## 🛠️ Tech Stack

- **Core:** React 18 + Vite  
- **Linguagem:** TypeScript / JavaScript (ES6+)  
- **Estilização:** Tailwind CSS  
- **Roteamento:** React Router DOM v6  
- **HTTP Client:** Axios  
- **Gráficos:** Recharts  
- **Ícones:** Lucide React  
- **Excel:** SheetJS (XLSX)

---

## 2. Estrutura do Projeto

```bash
src/
├── assets/          # Imagens, logos e arquivos estáticos
├── components/      # Componentes reutilizáveis
├── pages/           # Telas principais
│   ├── Dashboard.tsx
│   ├── Scheduler.tsx
│   ├── Login.tsx
│   ├── RegisterUser.tsx
│   └── RegisterProcess.tsx
├── services/
│   └── api.ts       # Axios + Interceptors
├── App.tsx          # Rotas e Layouts
└── main.tsx         # Entry point
3. Funcionalidades Principais
📊 Dashboard (Control Tower)
Painel de monitoramento em tempo real:

KPIs: Volume (In/Out), Backlog, Headcount

Gráfico Boca de Jacaré (Entrada vs Saída)

Alertas de gargalo operacional

📅 Scheduler (Simulador Inteligente)
Core do planejamento:

Turnos: T1, T2, T3

IA Smooth Week (zera backlog até domingo 14h)

Eficiência automática (refeições = 50%)

Exportação para Excel

🔐 Segurança & Admin
Login via JWT

Rotas protegidas (PrivateLayout)

Cadastro de usuários e processos

4. Instalação e Execução
Pré-requisitos
Node.js v18+

NPM ou Yarn

Instalação
npm install
Variáveis de Ambiente
Crie um arquivo .env:

VITE_API_URL=https://localhost:7000/api
Rodar em desenvolvimento
npm run dev
Acesse:
http://localhost:5173

5. Guia de Desenvolvimento
Criar Nova Página
Crie em src/pages/NovaTela.tsx

Adicione rota em App.tsx

Adicione no menu em Sidebar.tsx

Consumir API
Sempre use a instância central:

import { api } from '../services/api';

async function getData() {
  const response = await api.get('/endpoint');
  console.log(response.data);
}
6. Build e Deploy
Build de Produção
npm run build
Gera a pasta /dist.

Deploy
Pode ser hospedado em:

AWS S3 + CloudFront

Vercel / Netlify

Nginx / Apache

Azure Static Web Apps

📌 Padrões de Arquitetura
SPA com rotas protegidas

Componentização total

Separação por responsabilidade

API-first (backend independente)

📄 Licença
Labor Control Web © 2026
Interface Operacional de Workforce Management.

