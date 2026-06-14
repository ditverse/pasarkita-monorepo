import { api } from '../api';
import { ApiResponse, BuyerNotification } from '@/types/api';

export const notificationsApi = {
  getAll: (limit = 20) =>
    api.get<ApiResponse<BuyerNotification[]>>('/notifications', { params: { limit } }),

  markRead: (id: string) =>
    api.patch<ApiResponse<{ id: string; read_at: string }>>(`/notifications/${id}/read`),

  markAllRead: () =>
    api.patch<ApiResponse<{ changed: boolean }>>('/notifications/read-all'),
};
