import axios from 'axios';
import { useAuthStore } from '@/store/auth';
import { getApiBaseUrl } from '@/lib/api-base-url';

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/auth/login';
    }
    return Promise.reject(err);
  }
);
