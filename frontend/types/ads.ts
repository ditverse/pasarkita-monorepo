export interface HomeAdItem {
  kind: 'banner' | 'product_ad';
  id: string;
  title: string;
  subtitle?: string;
  caption?: string;
  image_url: string;
  target_url: string;
  product?: {
    id: string;
    name: string;
    price: number;
    shop_name: string;
  };
}

export interface ProductAd {
  id: string;
  product_id: string;
  seller_id: string;
  start_date: string;
  end_date: string;
  price_per_day: number;
  total_price: number;
  status: 'pending_payment' | 'scheduled' | 'active' | 'paused' | 'completed' | 'rejected';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  transaction_id?: string;
  placement: string;
  title?: string;
  caption?: string;
  target_url?: string;
  rejection_reason?: string;
  paused_reason?: string;
  created_at: string;
  product_name?: string;
  views_count?: number;
  clicks_count?: number;
  seller_name?: string;
  seller_email?: string;
}

export interface MarketplaceBanner {
  id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  target_url?: string;
  placement: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  is_active: boolean;
  views_count?: number;
  clicks_count?: number;
}
