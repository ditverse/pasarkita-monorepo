import { AdminAuditLog } from './admin';
import { AppliedVoucher } from './voucher';

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
  original_price_at_purchase?: number;
  product_discount_per_unit?: number;
  product_discount_id?: string | null;
};

export type Order = {
  id: string;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'payment_failed' | 'cancelled';
  subtotal: number;
  fee_marketplace: number;
  fee_marketplace_base?: number;
  fee_discount?: number;
  voucher_discount?: number;
  voucher_discount_total?: number;
  discount_total?: number;
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
  vouchers?: AppliedVoucher[];
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

export type CheckoutResponse = {
  order_id: string;
  status: string;
  subtotal: number;
  fee_marketplace: number;
  fee_marketplace_base?: number;
  fee_discount?: number;
  voucher_discount_total?: number;
  discount_total?: number;
  total: number;
  transaction_id: string;
  shipping: {
    tracking_id: string;
    status: string;
  };
  hardening_active: boolean;
  idempotent_replay: boolean;
};
