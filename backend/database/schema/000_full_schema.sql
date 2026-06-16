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
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id)
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
);CREATE TABLE public.order_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT order_chat_messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE TABLE public.product_chat_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_chat_threads_pkey PRIMARY KEY (id),
  CONSTRAINT product_chat_threads_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT product_chat_threads_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT product_chat_threads_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT product_chat_threads_unique UNIQUE (product_id, buyer_id, seller_id),
  CONSTRAINT product_chat_no_self CHECK (buyer_id <> seller_id)
);
CREATE TABLE public.product_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT product_chat_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.product_chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT product_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE
);
