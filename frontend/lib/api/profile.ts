import { api } from '../api';
import { Address, UserProfile, ApiResponse } from '@/types/api';

export const profileApi = {
  getProfile: () => 
    api.get<ApiResponse<UserProfile>>('/profile').then(res => res.data.data),

  updateProfile: (data: { name: string; phone?: string | null; avatar_url?: string | null }) =>
    api.patch<ApiResponse<UserProfile>>('/profile', data).then(res => res.data.data),

  getAddresses: () =>
    api.get<ApiResponse<Address[]>>('/profile/addresses').then(res => res.data.data),

  addAddress: (data: Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'>) =>
    api.post<ApiResponse<Address>>('/profile/addresses', data).then(res => res.data.data),

  updateAddress: (id: string, data: Partial<Address>) =>
    api.put<ApiResponse<Address>>(`/profile/addresses/${id}`, data).then(res => res.data.data),

  deleteAddress: (id: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/profile/addresses/${id}`).then(res => res.data.data),

  setPrimaryAddress: (id: string) =>
    api.put<ApiResponse<Address>>(`/profile/addresses/${id}/primary`).then(res => res.data.data),
};
