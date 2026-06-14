import { api } from '../api';
import type { Complaint } from '@/types/api';

export const complaintsApi = {
  // Semua role
  getAll: (params?: Record<string, string | number>) => api.get<{ data: Complaint[] }>('/complaints', { params }),
  getById: (id: string) => api.get<{ data: Complaint }>(`/complaints/${id}`),

  // Buyer
  create: (orderId: string, payload: { type: string; description: string }) =>
    api.post<{ data: Complaint }>(`/complaints/order/${orderId}`, payload),
  resolve: (id: string, payload: { accepted: boolean }) =>
    api.post<{ data: Complaint }>(`/complaints/${id}/resolve`, payload),

  // Seller
  reply: (id: string, payload: { reply: string }) =>
    api.post<{ data: Complaint }>(`/complaints/${id}/reply`, payload),

  // Admin
  adminResolve: (id: string, payload: { action: 'resolved' | 'rejected'; notes: string }) =>
    api.post<{ data: Complaint }>(`/complaints/${id}/admin-resolve`, payload),
};
