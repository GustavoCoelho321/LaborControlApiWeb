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