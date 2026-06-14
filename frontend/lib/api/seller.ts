import { api } from '../api';
import { ApiResponse, SellerAnalytics, SellerStoreProfile } from '@/types/api';

export const sellerApi = {
  getAnalytics: (params?: { period?: '7d' | '30d'; date_from?: string; date_to?: string }) =>
    api.get<ApiResponse<SellerAnalytics>>('/seller/analytics', { params }),
  getProfile: () =>
    api.get<ApiResponse<SellerStoreProfile>>('/seller/profile'),
  updateProfile: (body: {
    store_name: string;
    description: string;
    pickup_address: string;
    contact_phone: string;
    open_time: string;
    close_time: string;
    processing_days: number;
    logo_url?: string | null;
  }) => api.put<ApiResponse<SellerStoreProfile>>('/seller/profile', body),
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post<ApiResponse<{ logo_url: string; path: string }>>('/seller/profile/logo', formData);
  },
  setVacation: (payload: { is_on_vacation: boolean; vacation_until?: string | null }) =>
    api.patch<ApiResponse<SellerStoreProfile>>('/seller/vacation', payload),
};
