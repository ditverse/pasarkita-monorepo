import { api } from '../api';
import {
  AdminAuditLog,
  AdminModerationProduct,
  AdminModerationSeller,
  AdminProductDetail,
  AdminReportPreview,
  FeeSimulation,
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

  getModerationSellers: (params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<AdminModerationSeller>>('/admin/moderation/sellers', { params }),

  getModerationProducts: (params?: {
    search?: string;
    status?: string;
    stock?: string;
    category?: string;
    seller_id?: string;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<AdminModerationProduct>>('/admin/moderation/products', { params }),

  getModerationProductById: (id: string) =>
    api.get<ApiResponse<AdminProductDetail>>(`/admin/moderation/products/${id}`),

  moderateProduct: (
    id: string,
    body: {
      is_active: boolean;
      reason: string;
      rule:
        | 'policy_violation'
        | 'misleading_information'
        | 'prohibited_product'
        | 'quality_risk'
        | 'seller_request'
        | 'stock_restored'
        | 'review_completed'
        | 'other';
    }
  ) => api.patch<ApiResponse<AdminModerationProduct>>(`/admin/moderation/products/${id}/status`, body),

  updateUserStatus: (id: string, body: { is_active: boolean; reason?: string }) =>
    api.patch<ApiResponse<{ id: string; is_active: boolean }>>(`/admin/users/${id}/status`, body),

  getAnalytics: (params?: { period?: 'today' | '7d' | '30d'; start?: string; end?: string }) =>
    api.get<ApiResponse<AnalyticsSummary>>('/admin/analytics', { params }),

  getAuditLogs: (params?: { action?: string; target_type?: string; target_id?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<AdminAuditLog>>('/admin/audit-logs', { params }),

  previewReport: (params: Record<string, string | undefined>) =>
    api.get<ApiResponse<AdminReportPreview>>('/admin/reports/preview', { params }),

  exportReport: (params: Record<string, string | undefined>) =>
    api.get<Blob>('/admin/reports/export', { params, responseType: 'blob' }),

  simulateFeeImpact: (params: {
    period?: 'today' | '7d' | '30d';
    start?: string;
    end?: string;
    rate: number;
  }) => api.get<ApiResponse<FeeSimulation>>('/admin/fee-simulator', { params }),
};
