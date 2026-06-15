import { api } from '../api';
import { ApiResponse, RatingSummary } from '@/types/api';

export const ratingsApi = {
  /** Upload satu foto ulasan; return { image_url, path } */
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post<ApiResponse<{ image_url: string; path: string }>>(
      '/ratings/upload-image',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  /** Submit ulasan beserta array URL foto (opsional, maks 3) */
  submit: (body: {
    order_id: string;
    product_id: string;
    rating: number;
    comment?: string;
    image_urls?: string[];
  }) => api.post<ApiResponse<{ id: string }>>('/ratings', body),

  getByProduct: (productId: string) =>
    api.get<ApiResponse<RatingSummary>>(`/ratings/product/${productId}`),

  checkRated: (orderId: string, productId: string) =>
    api.get<ApiResponse<{ rated: boolean }>>(`/ratings/check/${orderId}/${productId}`),

  confirmDelivered: (orderId: string) =>
    api.post<ApiResponse<{ id: string; status: string }>>(`/orders/${orderId}/confirm`),

  /** Seller membalas ulasan */
  replyToRating: (ratingId: string, reply: string) =>
    api.post<ApiResponse<{ id: string; seller_reply: string }>>(`/ratings/${ratingId}/reply`, { reply }),
};
