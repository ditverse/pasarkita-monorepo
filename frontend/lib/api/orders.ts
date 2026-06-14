import { api } from '../api';
import { ApiResponse, PaginatedResponse, Order, PackingList } from '@/types/api';

export const ordersApi = {
  getAll: (params?: {
    status?: string;
    search?: string;
    created_from?: string;
    created_to?: string;
    sort?: 'created_desc' | 'created_asc' | 'total_desc' | 'total_asc' | 'status_asc' | 'status_desc' | 'updated_desc' | 'updated_asc' | 'action_deadline';
    page?: number;
    limit?: number;
  }) =>
    api.get<PaginatedResponse<Order>>('/orders', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Order>>(`/orders/${id}`),

  updateStatus: (id: string, body: { status: string; reason?: string }) =>
    api.patch<ApiResponse<Order>>(`/orders/${id}/status`, body),

  startProcessing: (id: string, pickupAddress: string) =>
    api.post<ApiResponse<Order>>(`/orders/${id}/process`, { pickup_address: pickupAddress }),

  ship: (id: string) =>
    api.post<ApiResponse<Order>>(`/orders/${id}/ship`),

  retryShipping: (id: string) =>
    api.post<ApiResponse<{ tracking_id: string; shipping_sync_status: 'synced' }>>(`/orders/${id}/shipping/retry`),

  getPackingList: (id: string) =>
    api.get<ApiResponse<PackingList>>(`/orders/${id}/packing-list`),

  getTracking: (id: string) =>
    api.get<ApiResponse<{
      tracking_id: string | null;
      status: string | null;
      to_address?: string;
      updated_at?: string;
      estimated_delivery?: string;
    } | null>>(`/orders/${id}/tracking`),

  exportSeller: (params?: { status?: string; search?: string; created_from?: string; created_to?: string }) =>
    api.get('/orders/seller-export', {
      params,
      responseType: 'blob',
    }),

  cancel: (id: string) =>
    api.post<ApiResponse<Order>>(`/orders/${id}/cancel`),

  confirm: (id: string) =>
    api.post<ApiResponse<Order>>(`/orders/${id}/confirm`),
};
