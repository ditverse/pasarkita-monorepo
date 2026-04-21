export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  is_active: boolean;
  seller: {
    id: string;
    name: string;
  };
};

export type OrderItem = {
  product_id: string;
  product_name: string;
  qty: number;
  price_at_purchase: number;
};

export type Order = {
  id: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'payment_failed';
  subtotal: number;
  fee_marketplace: number;
  total: number;
  shipping_address: string;
  transaction_id: string | null;
  tracking_id: string | null;
  created_at: string;
  items: OrderItem[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'buyer' | 'seller' | 'superadmin';
  is_active: boolean;
  created_at: string;
};

export type CheckoutResponse = {
  order_id: string;
  status: string;
  subtotal: number;
  fee_marketplace: number;
  total: number;
  transaction_id: string;
  shipping: {
    tracking_id: string;
    status: string;
  };
};

export type AnalyticsSummary = {
  period: string;
  summary: {
    total_orders: number;
    total_revenue: number;
    total_fee_marketplace: number;
    total_users: number;
    total_products: number;
  };
  orders_by_status: {
    paid: number;
    pending: number;
    payment_failed: number;
    delivered: number;
  };
  top_products: Array<{
    product_id: string;
    name: string;
    total_sold: number;
  }>;
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  error: {
    code: string;
    details?: string;
    retry_after?: number;
  };
};

export type PaginatedResponse<T> = ApiResponse<T[]> & {
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};
