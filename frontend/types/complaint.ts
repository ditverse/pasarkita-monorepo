import { Order } from './order';

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
