import { api } from '../api';
import { ApiResponse, CheckoutResponse } from '@/types/api';

export const checkoutApi = {
  checkout: (body: { items: { product_id: string; qty: number }[]; shipping_address: string }) =>
    api.post<ApiResponse<CheckoutResponse>>('/checkout', body),

  calculateFee: (body: { items: { product_id: string; qty: number }[] }) =>
    api.post<ApiResponse<{ subtotal: number; fee_marketplace: number; fee_percentage: number; total: number }>>('/fee/calculate', body),
};
