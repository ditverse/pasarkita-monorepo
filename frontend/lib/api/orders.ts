import { api } from '../api';
import { ApiResponse, PaginatedResponse, Order } from '@/types/api';

export const ordersApi = {
  getAll: (params?: {
    status?: string;
    search?: string;
    created_from?: string;
    created_to?: string;
    sort?: 'created_desc' | 'created_asc' | 'total_desc' | 'total_asc' | 'status_asc' | 'status_desc' | 'updated_desc' | 'updated_asc';
    page?: number;
    limit?: number;
  }) =>
    api.get<PaginatedResponse<Order>>('/orders', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Order>>(`/orders/${id}`),

  updateStatus: (id: string, body: { status: string; reason?: string }) =>
    api.patch<ApiResponse<Order>>(`/orders/${id}/status`, body),

  getTracking: (id: string) =>
    api.get<ApiResponse<{
      tracking_id: string | null;
      status: string | null;
      to_address?: string;
      updated_at?: string;
      estimated_delivery?: string;
    } | null>>(`/orders/${id}/tracking`),
};
