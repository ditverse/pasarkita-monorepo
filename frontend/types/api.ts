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

export type AdminUserDetail = {
  user: User;
  stats: {
    total_orders: number;
    paid_orders: number;
    total_spent: number;
    total_products: number;
    active_products: number;
  };
  recent_orders: Array<{
    id: string;
    status: Order['status'];
    total: number;
    transaction_id: string | null;
    tracking_id: string | null;
    created_at: string;
  }>;
  recent_products: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    is_active: boolean;
    created_at: string;
  }>;
  audit_history: {
    available: boolean;
    message?: string;
    data: Array<Omit<AdminAuditLog, 'target_type' | 'target_id'>>;
  };
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
  period: {
    start: string;
    end: string;
    timezone: string;
    granularity: 'hour' | 'day';
    generated_at: string;
  };
  summary: {
    gmv: number;
    marketplace_revenue: number;
    paid_orders: number;
    total_orders: number;
    average_order_value: number;
    payment_failure_rate: number;
    active_buyers: number;
    active_sellers: number;
    new_users: number;
    total_products: number;
    low_stock_products: number;
  };
  comparison: {
    gmv: number | null;
    marketplace_revenue: number | null;
    paid_orders: number | null;
    new_users: number | null;
  };
  timeseries: Array<{
    bucket: string;
    gmv: number;
    marketplace_revenue: number;
    orders: number;
    payment_success: number;
    payment_failed: number;
    shipping_created: number;
    shipped: number;
    delivered: number;
    new_buyers: number;
    new_sellers: number;
  }>;
  transaction_funnel: Array<{
    key: string;
    label: string;
    count: number;
  }>;
  orders_by_status: Array<{
    key: string;
    count: number;
    pct: number;
  }>;
  top_products: Array<{
    rank: number;
    product_id: string;
    name: string;
    seller: string;
    sold: number;
    gmv: number;
  }>;
  top_categories: Array<{
    category: string;
    sold: number;
    gmv: number;
  }>;
  marketplace_pulse: Array<{
    category: string;
    bucket: string;
    value: number;
  }>;
  integration_health: {
    available: boolean;
    message?: string;
    services: Array<{
      service: string;
      total_requests: number;
      success_rate: number;
      errors: number;
      latency_p50_ms: number | null;
      latency_p95_ms: number | null;
    }>;
  };
  action_center: Array<{
    key: string;
    severity: 'high' | 'medium' | 'low' | 'ok';
    title: string;
    count: number;
    href: string;
    owner: string;
    description: string;
  }>;
};

export type Rating = {
  id: string;
  rating: number;
  comment: string | null;
  date: string;
  buyer_name: string;
};

export type RatingSummary = {
  summary: {
    average: number;
    total: number;
    distribution: Record<string, number>;
  };
  reviews: Rating[];
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

export type AdminAuditLog = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
  actor: {
    id: string;
    name: string;
    email: string;
  };
};
