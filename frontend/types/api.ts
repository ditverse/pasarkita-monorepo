export type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: 'buyer' | 'seller' | 'superadmin';
  created_at: string;
};

export type Address = {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  full_address: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
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

export type SellerStoreProfile = {
  seller_id: string;
  store_name: string;
  logo_url: string | null;
  description: string | null;
  pickup_address: string | null;
  contact_phone: string | null;
  open_time: string;
  close_time: string;
  processing_days: number;
  verification_status: 'unverified' | 'demo_verified';
  is_on_vacation: boolean;
  vacation_until: string | null; // ISO date string (YYYY-MM-DD)
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  product_id: string;
  product_name: string;
  category?: string | null;
  seller?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  qty: number;
  price_at_purchase: number;
};

export type Order = {
  id: string;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'payment_failed' | 'cancelled';
  subtotal: number;
  fee_marketplace: number;
  total: number;
  shipping_address: string;
  transaction_id: string | null;
  tracking_id: string | null;
  processing_at?: string | null;
  shipped_at?: string | null;
  pickup_address_snapshot?: string | null;
  shipping_sync_status?: 'not_requested' | 'pending' | 'synced' | 'failed';
  shipping_sync_error?: string | null;
  shipping_sync_updated_at?: string | null;
  idempotency_key?: string | null;
  stock_reserved: boolean;
  created_at: string;
  updated_at?: string;
  buyer_id?: string;
  buyer?: {
    id: string;
    name: string;
    email: string;
  };
  items: OrderItem[];
  seller_item_scope?: boolean;
  seller_can_process?: boolean;
  seller_can_ship?: boolean;
  seller_action_reason?: string | null;
  status_history?: Array<{
    id: string;
    status: Order['status'];
    source: string;
    note: string | null;
    created_at: string;
  }>;
  audit_history?: {
    available: boolean;
    message?: string;
    data: Array<Omit<AdminAuditLog, 'target_type' | 'target_id'>>;
  };
  integration_timeline?: {
    available: boolean;
    message?: string;
    data: Array<{
      id: string;
      service: string;
      operation: string;
      success: boolean;
      duration_ms: number;
      status_code: number | null;
      error_code: string | null;
      created_at: string;
    }>;
  };
};

export type PackingList = {
  order_id: string;
  created_at: string;
  buyer_name: string;
  shipping_address: string;
  tracking_id: string | null;
  pickup_address: string | null;
  store_name: string;
  contact_phone: string | null;
  items: Array<{
    product_id: string;
    product_name: string;
    qty: number;
  }>;
};

export type BuyerNotification = {
  id: string;
  order_id: string | null;
  type: 'order' | 'payment' | 'shipped' | 'rating' | 'system';
  title: string;
  message: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export type SellerAnalytics = {
  period: {
    days: number;
    start: string;
    end: string;
    generated_at: string;
  };
  summary: {
    gross_sales: number;
    marketplace_fee: number;
    estimated_net: number;
    paid_orders: number;
    new_orders: number;
    overdue_orders: number;
    out_of_stock: number;
    low_stock: number;
    average_rating: number | null;
    new_reviews: number;
  };
  timeseries: Array<{
    bucket: string;
    gross_sales: number;
    estimated_net: number;
    orders: number;
  }>;
  orders_by_status: Array<{
    key: Order['status'];
    count: number;
    pct: number;
  }>;
  top_products: Array<{
    product_id: string;
    name: string;
    sold: number;
    gross_sales: number;
  }>;
  critical_stock: Array<{
    id: string;
    name: string;
    stock: number;
    minimum_stock: number;
    status: 'out' | 'low';
  }>;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
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

export type AdminModerationSeller = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  verification_status: 'not_configured';
  product_summary: {
    total_products: number;
    active_products: number;
    inactive_products: number;
    low_stock_products: number;
  };
};

export type AdminModerationProduct = {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  is_active: boolean;
  created_at: string;
  seller: {
    id: string;
    name: string;
    email: string;
    is_active: boolean;
  };
};

export type AdminReportPreview = {
  type: 'orders' | 'users' | 'sellers' | 'products' | 'analytics';
  row_count: number;
  columns: string[];
  sample: Array<Record<string, string | number | boolean | null>>;
  truncated: boolean;
};

export type AdminProductDetail = {
  product: AdminModerationProduct;
  stats: {
    sold_units: number;
    paid_order_count: number;
    gmv: number;
    average_rating: number | null;
    rating_count: number;
  };
  recent_orders: Array<{
    id: string;
    status: Order['status'];
    total: number;
    qty: number;
    price_at_purchase: number;
    created_at: string;
    buyer: { id: string; name: string; email: string } | null;
  }>;
  ratings: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    buyer: { id: string; name: string } | null;
  }>;
  audit_history: {
    available: boolean;
    message?: string;
    data: Array<Omit<AdminAuditLog, 'target_type' | 'target_id'>>;
  };
};

export type FeeSimulation = {
  period: { start: string; end: string; timezone: string };
  baseline: {
    production_fee_rate: number;
    paid_orders: number;
    subtotal: number;
    actual_revenue: number;
    actual_buyer_total: number;
  };
  selected_rate: number;
  selected_scenario: {
    rate: number;
    revenue: number;
    revenue_difference: number;
    average_fee_per_order: number;
    buyer_total: number;
    average_buyer_total: number;
  };
  scenarios: Array<{
    rate: number;
    revenue: number;
    revenue_difference: number;
    average_fee_per_order: number;
    buyer_total: number;
    average_buyer_total: number;
  }>;
  disclaimer: string;
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
  hardening_active: boolean;
  idempotent_replay: boolean;
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
  marketplace_health: {
    score: number;
    status: 'healthy' | 'attention' | 'critical';
    formula: string;
    components: Array<{
      key: string;
      label: string;
      score: number;
      weight: number;
      metric: string;
      explanation: string;
      href: string;
    }>;
    data_notes: string[];
  };
  anomalies: Array<{
    key: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    count: number;
    rule: string;
    href: string;
  }>;
  anomaly_coverage: Array<{
    rule: string;
    available: boolean;
    reason?: string;
  }>;
};
export type Complaint = {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  type: 'damaged' | 'missing_item' | 'wrong_item' | 'not_received' | 'other';
  description: string;
  status: 'open' | 'seller_replied' | 'admin_review' | 'resolved' | 'rejected';
  seller_response?: string | null;
  admin_notes?: string | null;
  resolution?: string | null;
  created_at: string;
  updated_at: string;
  orders?: {
    status: Order['status'];
    total: number;
    created_at: string;
    tracking_id?: string | null;
  };
  buyer?: { name: string; email: string };
  seller?: { name: string; email: string };
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
