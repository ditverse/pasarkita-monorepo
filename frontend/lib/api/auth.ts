import { api } from '../api';
import { ApiResponse, User } from '@/types/api';

export const authApi = {
  register: (body: { name: string; email: string; password: string; role: 'buyer' | 'seller' }) =>
    api.post<ApiResponse<User>>('/auth/register', body),

  login: (body: { email: string; password: string }) =>
    api.post<ApiResponse<{ token: string; user: User }>>('/auth/login', body),

  me: () =>
    api.get<ApiResponse<User>>('/auth/me'),

  updateProfile: (body: { name: string; email: string }) =>
    api.patch<ApiResponse<User>>('/auth/me', body),

  changePassword: (body: { current_password: string; new_password: string }) =>
    api.patch<ApiResponse<{ changed: boolean }>>('/auth/password', body),
};
