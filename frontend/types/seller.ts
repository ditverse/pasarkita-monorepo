import { Order } from './order';

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
