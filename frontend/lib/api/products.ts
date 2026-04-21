import { api } from '../api';
import { ApiResponse, PaginatedResponse, Product } from '@/types/api';

export const productsApi = {
  getAll: (params?: { search?: string; category?: string; sort?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Product>>('/products', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Product>>(`/products/${id}`),

  create: (body: { name: string; description?: string; category: string; price: number; stock: number }) =>
    api.post<ApiResponse<Product>>('/products', body),

  update: (id: string, body: Partial<{ name: string; description: string; category: string; price: number; stock: number }>) =>
    api.put<ApiResponse<Product>>(`/products/${id}`, body),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/products/${id}`),
};
