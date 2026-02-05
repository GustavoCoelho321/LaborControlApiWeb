import axios from 'axios';

export const api = axios.create({
  // Garanta que esta porta (7111) é a mesma que aparece quando você roda o backend (dotnet run)
  baseURL: 'https://localhost:7111/api', 
});

// Interceptor: Adiciona o Token automaticamente se ele existir
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Tratamento de Erro 429 - Rate Limit
    if (error.response && error.response.status === 429) {
      alert("Você está fazendo muitas requisições! Aguarde um momento e tente novamente.");
      // Opcional: Você pode retornar uma Promise que nunca resolve para "travar" a UI momentaneamente
      // ou apenas rejeitar o erro.
    }

    if (error.response && error.response.status === 401) {
       // Lógica de logout se token expirou
    }

    return Promise.reject(error);
  }
);