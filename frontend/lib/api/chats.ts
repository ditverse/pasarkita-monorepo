import { api } from '../api';
import type { ApiResponse } from '@/types/api';

export type OrderChatMessage = {
  id: string;
  order_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type ProductChatThread = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    image_url: string | null;
    price: number;
  } | null;
  buyer?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  seller?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  last_message?: ProductChatMessage | null;
};

export type ProductChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export const chatsApi = {

  getOrderMessages: (orderId: string, params?: { limit?: number }) =>
    api.get<ApiResponse<OrderChatMessage[]>>(`/chats/orders/${orderId}/messages`, { params }),

  sendOrderMessage: (orderId: string, payload: { content: string }) =>
    api.post<ApiResponse<OrderChatMessage>>(`/chats/orders/${orderId}/messages`, payload),

  getProductThreads: () =>
    api.get<ApiResponse<ProductChatThread[]>>('/chats/products/threads'),

  startProductChat: (productId: string, payload?: { content?: string }) =>
    api.post<ApiResponse<ProductChatThread>>(`/chats/products/${productId}/start`, payload ?? {}),

  getProductMessages: (threadId: string, params?: { limit?: number }) =>
    api.get<ApiResponse<ProductChatMessage[]>>(`/chats/products/threads/${threadId}/messages`, { params }),

  sendProductMessage: (threadId: string, payload: { content: string }) =>
    api.post<ApiResponse<ProductChatMessage>>(`/chats/products/threads/${threadId}/messages`, payload),
};

