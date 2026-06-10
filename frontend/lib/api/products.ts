import { api } from '../api';
import { ApiResponse, PaginatedResponse, Product } from '@/types/api';

export const productsApi = {
  getAll: (params?: { search?: string; category?: string; sort?: string; page?: number; limit?: number; seller_id?: string }) =>
    api.get<PaginatedResponse<Product>>('/products', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Product>>(`/products/${id}`),

  getMine: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Product>>('/products/mine', { params }),

  getMineById: (id: string) =>
    api.get<ApiResponse<Product>>(`/products/mine/${id}`),

  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post<ApiResponse<{ image_url: string; path: string }>>('/products/images', formData);
  },

  create: (body: { name: string; description?: string; category: string; price: number; stock: number; image_url?: string | null }) =>
    api.post<ApiResponse<Product>>('/products', body),

  update: (id: string, body: Partial<{ name: string; description: string; category: string; price: number; stock: number; is_active: boolean; image_url: string | null }>) =>
    api.put<ApiResponse<Product>>(`/products/${id}`, body),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/products/${id}`),
};
