-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['buyer'::character varying, 'seller'::character varying, 'superadmin'::character varying]::text[])),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  phone character varying,
  avatar_url text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  category character varying NOT NULL,
  price integer NOT NULL CHECK (price > 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text,
  minimum_stock integer NOT NULL DEFAULT 5 CHECK (minimum_stock >= 0),
  is_low_stock boolean DEFAULT ((stock > 0) AND (stock <= minimum_stock)),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  status character varying NOT NULL DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'paid'::character varying, 'processing'::character varying, 'shipped'::character varying, 'delivered'::character varying, 'payment_failed'::character varying, 'cancelled'::character varying]::text[])),
  subtotal integer NOT NULL CHECK (subtotal > 0),
  fee_marketplace integer NOT NULL DEFAULT 0,
  total integer NOT NULL CHECK (total > 0),
  shipping_address text NOT NULL,
  transaction_id character varying,
  tracking_id character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  idempotency_key uuid,
  stock_reserved boolean NOT NULL DEFAULT false,
  processing_at timestamp with time zone,
  shipped_at timestamp with time zone,
  pickup_address_snapshot text,
  shipping_sync_status character varying NOT NULL DEFAULT 'not_requested'::character varying CHECK (shipping_sync_status::text = ANY (ARRAY['not_requested'::character varying, 'pending'::character varying, 'synced'::character varying, 'failed'::character varying]::text[])),
  shipping_sync_error text,
  shipping_sync_updated_at timestamp with time zone,
  voucher_id uuid,
  voucher_discount integer NOT NULL DEFAULT 0 CHECK (voucher_discount >= 0),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id),
  CONSTRAINT orders_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id)
);
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  price_at_purchase integer NOT NULL CHECK (price_at_purchase > 0),
  product_name_at_purchase text,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  image_urls ARRAY NOT NULL DEFAULT '{}'::text[],
  seller_reply text,
  seller_replied_at timestamp with time zone,
  CONSTRAINT ratings_pkey PRIMARY KEY (id),
  CONSTRAINT ratings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT ratings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT ratings_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id)
);
CREATE TABLE public.admin_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT admin_audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id)
);
CREATE TABLE public.integration_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service text NOT NULL,
  operation text NOT NULL,
  success boolean NOT NULL,
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  order_id uuid,
  status_code integer,
  error_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT integration_logs_pkey PRIMARY KEY (id),
  CONSTRAINT integration_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.order_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  status character varying NOT NULL CHECK (status::text = ANY (ARRAY['pending'::character varying, 'paid'::character varying, 'processing'::character varying, 'shipped'::character varying, 'delivered'::character varying, 'payment_failed'::character varying, 'cancelled'::character varying]::text[])),
  actor_id uuid,
  source text NOT NULL DEFAULT 'system'::text,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_status_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['order'::text, 'payment'::text, 'shipped'::text, 'rating'::text, 'system'::text])),
  title text NOT NULL,
  message text NOT NULL,
  href text,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT notifications_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.seller_profiles (
  seller_id uuid NOT NULL,
  store_name character varying NOT NULL,
  logo_url text,
  description text,
  pickup_address text,
  contact_phone character varying,
  open_time time without time zone NOT NULL DEFAULT '08:00:00'::time without time zone,
  close_time time without time zone NOT NULL DEFAULT '17:00:00'::time without time zone,
  processing_days integer NOT NULL DEFAULT 2 CHECK (processing_days >= 1 AND processing_days <= 30),
  verification_status character varying NOT NULL DEFAULT 'unverified'::character varying CHECK (verification_status::text = ANY (ARRAY['unverified'::character varying, 'demo_verified'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT seller_profiles_pkey PRIMARY KEY (seller_id),
  CONSTRAINT seller_profiles_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label character varying NOT NULL,
  recipient_name character varying NOT NULL,
  phone character varying NOT NULL,
  full_address text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_addresses_pkey PRIMARY KEY (id),
  CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.complaints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['damaged'::character varying, 'missing_item'::character varying, 'wrong_item'::character varying, 'not_received'::character varying, 'other'::character varying]::text[])),
  description text NOT NULL,
  status character varying NOT NULL DEFAULT 'open'::character varying CHECK (status::text = ANY (ARRAY['open'::character varying, 'seller_replied'::character varying, 'admin_review'::character varying, 'resolved'::character varying, 'rejected'::character varying]::text[])),
  seller_response text,
  admin_notes text,
  resolution text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT complaints_pkey PRIMARY KEY (id),
  CONSTRAINT complaints_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT complaints_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id),
  CONSTRAINT complaints_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id)
);
CREATE TABLE public.order_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT order_chat_messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id)
);
CREATE TABLE public.product_chat_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_chat_threads_pkey PRIMARY KEY (id),
  CONSTRAINT product_chat_threads_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_chat_threads_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id),
  CONSTRAINT product_chat_threads_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id)
);
CREATE TABLE public.product_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT product_chat_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.product_chat_threads(id),
  CONSTRAINT product_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id)
);
CREATE TABLE public.product_ads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  price_per_day integer NOT NULL DEFAULT 5000 CHECK (price_per_day >= 0),
  total_price integer NOT NULL CHECK (total_price >= 0),
  status character varying NOT NULL DEFAULT 'pending_payment'::character varying CHECK (status::text = ANY (ARRAY['pending_payment'::character varying::text, 'scheduled'::character varying::text, 'active'::character varying::text, 'paused'::character varying::text, 'completed'::character varying::text])),
  payment_status character varying NOT NULL DEFAULT 'unpaid'::character varying CHECK (payment_status::text = ANY (ARRAY['unpaid'::character varying::text, 'paid'::character varying::text, 'refunded'::character varying::text])),
  transaction_id character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_ads_pkey PRIMARY KEY (id),
  CONSTRAINT product_ads_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_ads_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id)
);
CREATE TABLE public.ad_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL UNIQUE,
  views_count integer NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  clicks_count integer NOT NULL DEFAULT 0 CHECK (clicks_count >= 0),
  last_recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ad_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT ad_analytics_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES public.product_ads(id)
);
CREATE TABLE public.product_discounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  discount_type character varying NOT NULL CHECK (discount_type::text = ANY (ARRAY['percentage'::character varying::text, 'fixed_amount'::character varying::text])),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_discounts_pkey PRIMARY KEY (id),
  CONSTRAINT product_discounts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.vouchers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_id uuid,
  code character varying NOT NULL UNIQUE,
  discount_type character varying NOT NULL CHECK (discount_type::text = ANY (ARRAY['percentage'::character varying::text, 'fixed_amount'::character varying::text])),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  min_purchase integer NOT NULL DEFAULT 0 CHECK (min_purchase >= 0),
  max_discount integer CHECK (max_discount > 0),
  quota integer NOT NULL CHECK (quota > 0),
  used_count integer NOT NULL DEFAULT 0,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  category character varying,
  CONSTRAINT vouchers_pkey PRIMARY KEY (id),
  CONSTRAINT vouchers_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_vouchers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  voucher_id uuid NOT NULL,
  order_id uuid,
  used_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_vouchers_pkey PRIMARY KEY (id),
  CONSTRAINT user_vouchers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_vouchers_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id),
  CONSTRAINT user_vouchers_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);