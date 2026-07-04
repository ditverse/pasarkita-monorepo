export type ActiveDiscount = {
  id: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  discount_per_unit: number;
  start_time: string;
  end_time: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  minimum_stock?: number;
  is_low_stock?: boolean;
  is_active: boolean;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
  rating_average?: number | null;
  rating_count?: number;
  sold_units?: number;
  original_price?: number;
  effective_price?: number;
  active_discount?: ActiveDiscount | null;
  seller: {
    id: string;
    name: string;
  };
};

export type PublicStore = {
  seller: {
    id: string;
    name: string;
    store_name: string;
    logo_url: string | null;
    description: string | null;
    contact_phone: string | null;
    open_time: string | null;
    close_time: string | null;
    processing_days: number | null;
    verification_status: 'unverified' | 'demo_verified';
    created_at: string;
    is_active: boolean;
  };
  stats: {
    active_products: number;
    sold_units: number;
    rating_average: number | null;
    rating_count: number;
    tracking_coverage: number | null;
  };
};

export type ProductDiscount = {
  id: string;
  product_id: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  product?: Pick<Product, 'id' | 'name' | 'price' | 'category'>;
};
