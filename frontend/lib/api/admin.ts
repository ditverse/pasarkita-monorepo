import { api } from '../api';
import { ApiResponse, PaginatedResponse, User, AnalyticsSummary } from '@/types/api';

export const adminApi = {
  getUsers: (params?: { role?: string; status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<User>>('/admin/users', { params }),

  updateUserStatus: (id: string, body: { is_active: boolean; reason?: string }) =>
    api.patch<ApiResponse<{ id: string; is_active: boolean }>>(`/admin/users/${id}/status`, body),

  getAnalytics: (params?: { period?: string; start?: string; end?: string }) =>
    api.get<ApiResponse<AnalyticsSummary>>('/admin/analytics', { params }),
};
