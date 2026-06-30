import { api } from '../api';
import { ApiResponse, PromotionQuote, SellerPromotions, ProductDiscount, Voucher } from '@/types/api';

export type PromotionQuoteRequest = {
  items: { product_id: string; qty: number }[];
  marketplace_voucher_code?: string | null;
  seller_voucher_codes?: string[];
};

export type DiscountPayload = {
  product_id: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
};

export type VoucherPayload = {
  code: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free_marketplace_fee';
  discount_value: number;
  min_purchase?: number;
  max_discount?: number | null;
  quota: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
  category?: string | null;
};

export const promotionsApi = {
  quote: (body: PromotionQuoteRequest) =>
    api.post<ApiResponse<PromotionQuote>>('/promotions/quote', body),

  availableVouchers: () =>
    api.get<ApiResponse<Voucher[]>>('/promotions/vouchers/available'),

  getSellerPromotions: () =>
    api.get<ApiResponse<SellerPromotions>>('/seller/promotions'),

  createSellerDiscount: (body: DiscountPayload) =>
    api.post<ApiResponse<ProductDiscount>>('/seller/promotions/discounts', body),

  updateSellerDiscount: (id: string, body: Partial<DiscountPayload>) =>
    api.patch<ApiResponse<ProductDiscount>>(`/seller/promotions/discounts/${id}`, body),

  createSellerVoucher: (body: Omit<VoucherPayload, 'discount_type'> & { discount_type: 'percentage' | 'fixed_amount' }) =>
    api.post<ApiResponse<Voucher>>('/seller/promotions/vouchers', body),

  updateSellerVoucher: (id: string, body: Partial<Omit<VoucherPayload, 'discount_type'> & { discount_type: 'percentage' | 'fixed_amount' }>) =>
    api.patch<ApiResponse<Voucher>>(`/seller/promotions/vouchers/${id}`, body),

  getMarketplaceVouchers: () =>
    api.get<ApiResponse<Voucher[]>>('/admin/promotions/vouchers'),

  createMarketplaceVoucher: (body: VoucherPayload) =>
    api.post<ApiResponse<Voucher>>('/admin/promotions/vouchers', body),

  updateMarketplaceVoucher: (id: string, body: Partial<VoucherPayload>) =>
    api.patch<ApiResponse<Voucher>>(`/admin/promotions/vouchers/${id}`, body),
};
