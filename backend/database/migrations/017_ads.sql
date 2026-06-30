-- Create marketplace_banners table
CREATE TABLE IF NOT EXISTS public.marketplace_banners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title character varying NOT NULL,
  subtitle character varying,
  image_url text NOT NULL,
  target_url text,
  placement character varying NOT NULL DEFAULT 'home_carousel',
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_banners_pkey PRIMARY KEY (id),
  CONSTRAINT marketplace_banners_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- Expand product_ads table
ALTER TABLE public.product_ads
ADD COLUMN IF NOT EXISTS placement character varying NOT NULL DEFAULT 'home_carousel',
ADD COLUMN IF NOT EXISTS title character varying,
ADD COLUMN IF NOT EXISTS caption character varying,
ADD COLUMN IF NOT EXISTS target_url character varying,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS paused_reason text,
ADD COLUMN IF NOT EXISTS reviewed_by uuid,
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;

-- Recreate constraint status to allow 'rejected'
ALTER TABLE public.product_ads DROP CONSTRAINT IF EXISTS product_ads_status_check;
ALTER TABLE public.product_ads ADD CONSTRAINT product_ads_status_check 
CHECK (status::text = ANY (ARRAY['pending_payment'::text, 'scheduled'::text, 'active'::text, 'paused'::text, 'completed'::text, 'rejected'::text]));

-- Add foreign key constraint for reviewed_by
ALTER TABLE public.product_ads DROP CONSTRAINT IF EXISTS product_ads_reviewed_by_fkey;
ALTER TABLE public.product_ads
ADD CONSTRAINT product_ads_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);

-- Create banner_analytics table
CREATE TABLE IF NOT EXISTS public.banner_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  banner_id uuid NOT NULL UNIQUE,
  views_count integer NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  clicks_count integer NOT NULL DEFAULT 0 CHECK (clicks_count >= 0),
  last_recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT banner_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT banner_analytics_banner_id_fkey FOREIGN KEY (banner_id) REFERENCES public.marketplace_banners(id) ON DELETE CASCADE
);
