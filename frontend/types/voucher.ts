import { Product, ActiveDiscount } from './product';

export type AppliedVoucher = {
  id: string;
  code: string;
  scope: 'marketplace' | 'seller';
  seller_id: string | null;
  discount_type: 'percentage' | 'fixed_amount' | 'free_marketplace_fee';
  discount_amount: number;
  eligible_subtotal: number;
};

export type RejectedVoucher = {
  code: string;
  reason: string;
};

export type PromotionQuoteItem = {
  product_id: string;
  product_name: string;
  seller_id: string;
  seller?: { id: string; name: string } | null;
  category: string;
  qty: number;
  original_price: number;
  effective_price: number;
  original_subtotal: number;
  product_discount_per_unit: number;
  product_discount_total: number;
  subtotal_after_product_discount: number;
  active_discount: ActiveDiscount | null;
};

export type PromotionQuote = {
  subtotal_original: number;
  product_discount_total: number;
  subtotal_after_product_discount: number;
  fee_marketplace_base: number;
  fee_discount: number;
  fee_marketplace: number;
  voucher_discount_total: number;
  discount_total: number;
  total: number;
  items: PromotionQuoteItem[];
  applied_vouchers: AppliedVoucher[];
  rejected_vouchers: RejectedVoucher[];
};

export type Voucher = {
  id: string;
  seller_id: string | null;
  code: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free_marketplace_fee';
  discount_value: number;
  min_purchase: number;
  max_discount: number | null;
  quota: number;
  used_count: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  category: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SellerPromotions = {
  products: Product[];
  discounts: import('./product').ProductDiscount[];
  vouchers: Voucher[];
};
