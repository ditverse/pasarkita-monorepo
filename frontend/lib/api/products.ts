import { api } from '../api';
import { ApiResponse, PaginatedResponse, Product, PublicStore } from '@/types/api';

export const productsApi = {
  getAll: (params?: {
    search?: string;
    category?: string;
    sort?: string;
    page?: number;
    limit?: number;
    seller_id?: string;
    min_price?: number;
    max_price?: number;
    in_stock?: boolean;
  }) =>
    api.get<PaginatedResponse<Product>>('/products', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Product>>(`/products/${id}`),

  getStore: (sellerId: string) =>
    api.get<ApiResponse<PublicStore>>(`/products/stores/${sellerId}`),

  getMine: (params?: {
    search?: string;
    status?: 'active' | 'inactive';
    stock?: 'low' | 'out';
    sort?: 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc' | 'status_asc' | 'status_desc';
    page?: number;
    limit?: number;
  }) =>
    api.get<PaginatedResponse<Product>>('/products/mine', { params }),

  getMineById: (id: string) =>
    api.get<ApiResponse<Product>>(`/products/mine/${id}`),

  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post<ApiResponse<{ image_url: string; path: string }>>('/products/images', formData);
  },

  create: (body: { name: string; description: string; category: string; price: number; stock: number; minimum_stock: number; image_url?: string | null }) =>
    api.post<ApiResponse<Product>>('/products', body),

  update: (id: string, body: Partial<{ name: string; description: string; category: string; price: number; stock: number; minimum_stock: number; is_active: boolean; image_url: string | null }>) =>
    api.put<ApiResponse<Product>>(`/products/${id}`, body),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/products/${id}`),

  exportMine: (params?: { search?: string; status?: string; stock?: string }) =>
    api.get('/products/mine/export', {
      params,
      responseType: 'blob',
    }),
};
