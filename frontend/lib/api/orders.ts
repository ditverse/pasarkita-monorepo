import { api } from '../api';
import { ApiResponse, PaginatedResponse, Order } from '@/types/api';

export const ordersApi = {
  getAll: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Order>>('/orders', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Order>>(`/orders/${id}`),

  updateStatus: (id: string, body: { status: string }) =>
    api.patch<ApiResponse<Order>>(`/orders/${id}/status`, body),
};
