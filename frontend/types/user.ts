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
