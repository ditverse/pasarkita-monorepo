import { api } from '../api';
import { ApiResponse, RatingSummary } from '@/types/api';

export const ratingsApi = {
  submit: (body: { order_id: string; product_id: string; rating: number; comment?: string }) =>
    api.post<ApiResponse<{ id: string }>>('/ratings', body),

  getByProduct: (productId: string) =>
    api.get<ApiResponse<RatingSummary>>(`/ratings/product/${productId}`),

  checkRated: (orderId: string, productId: string) =>
    api.get<ApiResponse<{ rated: boolean }>>(`/ratings/check/${orderId}/${productId}`),

  confirmDelivered: (orderId: string) =>
    api.post<ApiResponse<{ id: string; status: string }>>(`/orders/${orderId}/confirm`),
};
