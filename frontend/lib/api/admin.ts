import { api } from '../api';
import {
  AdminAuditLog,
  AdminUserDetail,
  ApiResponse,
  PaginatedResponse,
  User,
  AnalyticsSummary,
} from '@/types/api';

export const adminApi = {
  getUsers: (params?: {
    role?: string;
    status?: string;
    search?: string;
    created_from?: string;
    created_to?: string;
    sort?: 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc';
    page?: number;
    limit?: number;
  }) =>
    api.get<PaginatedResponse<User>>('/admin/users', { params }),

  getUserById: (id: string) =>
    api.get<ApiResponse<AdminUserDetail>>(`/admin/users/${id}`),

  updateUserStatus: (id: string, body: { is_active: boolean; reason?: string }) =>
    api.patch<ApiResponse<{ id: string; is_active: boolean }>>(`/admin/users/${id}/status`, body),

  getAnalytics: (params?: { period?: 'today' | '7d' | '30d'; start?: string; end?: string }) =>
    api.get<ApiResponse<AnalyticsSummary>>('/admin/analytics', { params }),

  getAuditLogs: (params?: { action?: string; target_type?: string; target_id?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<AdminAuditLog>>('/admin/audit-logs', { params }),
};
