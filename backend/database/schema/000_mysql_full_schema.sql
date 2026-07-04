-- ============================================================
-- PasarKita — MySQL Schema (migrasi dari Supabase PostgreSQL)
-- Target: MySQL 8.0+ (mendukung CHECK constraints, JSON, generated columns)
-- Dibuat: 1 Juli 2026
-- ============================================================

-- ------------------------------------------------------------
-- CATATAN KONVERSI TIPE DATA
--   PostgreSQL          → MySQL
--   ------------------  → -------------------------
--   UUID                → CHAR(36)
--   gen_random_uuid()   → (UUID() di application layer)
--   TIMESTAMPTZ         → DATETIME
--   BOOLEAN             → TINYINT(1) DEFAULT 1
--   JSONB               → JSON
--   TEXT[] (ARRAY)      → JSON
--   TIME                → TIME
--   SERIAL              → INT AUTO_INCREMENT
--   now()               → NOW() / CURRENT_TIMESTAMP
-- ------------------------------------------------------------

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ============================================================
-- 1. USERS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id). Tidak ada transitive dependency.

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('buyer', 'seller', 'superadmin')),
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  phone         VARCHAR(30)  DEFAULT NULL,
  avatar_url    TEXT         DEFAULT NULL,

  CONSTRAINT pk_users PRIMARY KEY (id),
  CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 2. SELLER_PROFILES
-- ============================================================
-- 3NF: ✅ 1:1 dengan users. Semua kolom bergantung pada seller_id.

CREATE TABLE IF NOT EXISTS seller_profiles (
  seller_id            CHAR(36)    NOT NULL,
  store_name           VARCHAR(120) NOT NULL,
  logo_url             TEXT        DEFAULT NULL,
  description          TEXT        DEFAULT NULL,
  pickup_address       TEXT        DEFAULT NULL,
  contact_phone        VARCHAR(30) DEFAULT NULL,
  open_time            TIME        NOT NULL DEFAULT '08:00:00',
  close_time           TIME        NOT NULL DEFAULT '17:00:00',
  processing_days      INT         NOT NULL DEFAULT 2 CHECK (processing_days BETWEEN 1 AND 30),
  verification_status  VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'demo_verified')),
  created_at           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_seller_profiles PRIMARY KEY (seller_id),
  CONSTRAINT fk_seller_profiles_user FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 3. PRODUCTS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).
--   `is_low_stock` adalah computed column (MySQL generated column).

CREATE TABLE IF NOT EXISTS products (
  id              CHAR(36)     NOT NULL,
  seller_id       CHAR(36)     NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT         DEFAULT NULL,
  category        VARCHAR(100) NOT NULL,
  price           INT          NOT NULL CHECK (price > 0),
  stock           INT          NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  image_url       TEXT         DEFAULT NULL,
  minimum_stock   INT          NOT NULL DEFAULT 5 CHECK (minimum_stock >= 0),
  is_low_stock    TINYINT(1)   GENERATED ALWAYS AS (stock > 0 AND stock <= minimum_stock) STORED,

  CONSTRAINT pk_products PRIMARY KEY (id),
  CONSTRAINT fk_products_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_products_seller (seller_id),
  INDEX idx_products_active_category (is_active, category),
  INDEX idx_products_seller_stock (seller_id, is_low_stock, stock)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 4. USER_ADDRESSES
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).

CREATE TABLE IF NOT EXISTS user_addresses (
  id             CHAR(36)     NOT NULL,
  user_id        CHAR(36)     NOT NULL,
  label          VARCHAR(50)  NOT NULL,
  recipient_name VARCHAR(255) NOT NULL,
  phone          VARCHAR(30)  NOT NULL,
  full_address   TEXT         NOT NULL,
  is_primary     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_user_addresses PRIMARY KEY (id),
  CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_addresses_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Unique index: satu user hanya boleh punya satu primary address
-- (di MySQL, partial index tidak didukung → gunakan trigger atau aplikasi layer)


-- ============================================================
-- 5. VOUCHERS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).
--   `used_count` adalah counter yang di-update secara atomik.

CREATE TABLE IF NOT EXISTS vouchers (
  id             CHAR(36)     NOT NULL,
  seller_id      CHAR(36)     DEFAULT NULL,
  code           VARCHAR(50)  NOT NULL,
  discount_type  VARCHAR(30)  NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_marketplace_fee')),
  discount_value INT          NOT NULL CHECK (discount_value > 0),
  min_purchase   INT          NOT NULL DEFAULT 0 CHECK (min_purchase >= 0),
  max_discount   INT          DEFAULT NULL CHECK (max_discount IS NULL OR max_discount > 0),
  quota          INT          NOT NULL CHECK (quota > 0),
  used_count     INT          NOT NULL DEFAULT 0,
  start_time     DATETIME     NOT NULL,
  end_time       DATETIME     NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  category       VARCHAR(100) DEFAULT NULL,

  CONSTRAINT pk_vouchers PRIMARY KEY (id),
  CONSTRAINT uq_vouchers_code UNIQUE (code),
  CONSTRAINT fk_vouchers_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 6. PRODUCT_DISCOUNTS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).

CREATE TABLE IF NOT EXISTS product_discounts (
  id             CHAR(36)     NOT NULL,
  product_id     CHAR(36)     NOT NULL,
  discount_type  VARCHAR(30)  NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value INT          NOT NULL CHECK (discount_value > 0),
  start_time     DATETIME     NOT NULL,
  end_time       DATETIME     NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_product_discounts PRIMARY KEY (id),
  CONSTRAINT fk_product_discounts_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 7. ORDERS
-- ============================================================
-- 3NF: ⚠️  Beberapa kolom adalah snapshot/denormalisasi yang disengaja:
--   - `total` = subtotal + fee_marketplace (derived, tapi disimpan untuk akurasi historis)
--   - Kolom diskon voucher disimpan sebagai snapshot saat checkout
--  Ini adalah common practice untuk marketplace systems.

CREATE TABLE IF NOT EXISTS orders (
  id                        CHAR(36)     NOT NULL,
  buyer_id                  CHAR(36)     NOT NULL,
  status                    VARCHAR(20)  NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'payment_failed', 'cancelled')),
  subtotal                  INT          NOT NULL CHECK (subtotal > 0),
  fee_marketplace           INT          NOT NULL DEFAULT 0,
  total                     INT          NOT NULL CHECK (total > 0),
  shipping_address          TEXT         NOT NULL,
  transaction_id            VARCHAR(255) DEFAULT NULL,
  tracking_id               VARCHAR(255) DEFAULT NULL,
  created_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  idempotency_key           CHAR(36)     DEFAULT NULL,
  stock_reserved            TINYINT(1)   NOT NULL DEFAULT 0,
  processing_at             DATETIME     DEFAULT NULL,
  shipped_at                DATETIME     DEFAULT NULL,
  pickup_address_snapshot   TEXT         DEFAULT NULL,
  shipping_sync_status      VARCHAR(20)  NOT NULL DEFAULT 'not_requested'
    CHECK (shipping_sync_status IN ('not_requested', 'pending', 'synced', 'failed')),
  shipping_sync_error       TEXT         DEFAULT NULL,
  shipping_sync_updated_at  DATETIME     DEFAULT NULL,
  voucher_id                CHAR(36)     DEFAULT NULL,
  voucher_discount          INT          NOT NULL DEFAULT 0 CHECK (voucher_discount >= 0),
  fee_marketplace_base      INT          NOT NULL DEFAULT 0 CHECK (fee_marketplace_base >= 0),
  fee_discount              INT          NOT NULL DEFAULT 0 CHECK (fee_discount >= 0),
  voucher_discount_total    INT          NOT NULL DEFAULT 0 CHECK (voucher_discount_total >= 0),
  discount_total            INT          NOT NULL DEFAULT 0 CHECK (discount_total >= 0),

  CONSTRAINT pk_orders PRIMARY KEY (id),
  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL,
  INDEX idx_orders_buyer_created (buyer_id, created_at DESC),
  INDEX idx_orders_status (status),
  INDEX idx_orders_seller_fulfillment (status, processing_at, shipped_at),
  UNIQUE INDEX idx_orders_buyer_idempotency (buyer_id, idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 8. ORDER_ITEMS
-- ============================================================
-- 3NF: ✅ Snapshot values (price_at_purchase, product_name_at_purchase) disengaja untuk akurasi historis.

CREATE TABLE IF NOT EXISTS order_items (
  id                            CHAR(36) NOT NULL,
  order_id                      CHAR(36) NOT NULL,
  product_id                    CHAR(36) NOT NULL,
  qty                           INT      NOT NULL CHECK (qty > 0),
  price_at_purchase             INT      NOT NULL CHECK (price_at_purchase > 0),
  product_name_at_purchase      TEXT     DEFAULT NULL,
  original_price_at_purchase    INT      DEFAULT NULL CHECK (original_price_at_purchase IS NULL OR original_price_at_purchase > 0),
  product_discount_per_unit     INT      NOT NULL DEFAULT 0 CHECK (product_discount_per_unit >= 0),
  product_discount_id           CHAR(36) DEFAULT NULL,

  CONSTRAINT pk_order_items PRIMARY KEY (id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_items_discount FOREIGN KEY (product_discount_id) REFERENCES product_discounts(id) ON DELETE SET NULL,
  INDEX idx_order_items_order (order_id),
  INDEX idx_order_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 9. ORDER_STATUS_HISTORY
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).

CREATE TABLE IF NOT EXISTS order_status_history (
  id         CHAR(36)     NOT NULL,
  order_id   CHAR(36)     NOT NULL,
  status     VARCHAR(20)  NOT NULL CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'payment_failed', 'cancelled')),
  actor_id   CHAR(36)     DEFAULT NULL,
  source     VARCHAR(50)  NOT NULL DEFAULT 'system',
  note       TEXT         DEFAULT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_order_status_history PRIMARY KEY (id),
  CONSTRAINT fk_osh_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_osh_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_osh_order_created (order_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 10. RATINGS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).
--   `image_urls` dikonversi dari TEXT[] (PostgreSQL ARRAY) ke JSON (MySQL).

CREATE TABLE IF NOT EXISTS ratings (
  id                 CHAR(36)  NOT NULL,
  order_id           CHAR(36)  NOT NULL,
  product_id         CHAR(36)  NOT NULL,
  buyer_id           CHAR(36)  NOT NULL,
  rating             INT       NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment            TEXT      DEFAULT NULL,
  created_at         DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  image_urls         JSON      NOT NULL DEFAULT (JSON_ARRAY()),
  seller_reply       TEXT      DEFAULT NULL,
  seller_replied_at  DATETIME  DEFAULT NULL,

  CONSTRAINT pk_ratings PRIMARY KEY (id),
  CONSTRAINT fk_ratings_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_ratings_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_ratings_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ratings_product (product_id),
  INDEX idx_ratings_buyer (buyer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 11. NOTIFICATIONS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).

CREATE TABLE IF NOT EXISTS notifications (
  id         CHAR(36)     NOT NULL,
  user_id    CHAR(36)     NOT NULL,
  order_id   CHAR(36)     DEFAULT NULL,
  type       VARCHAR(20)  NOT NULL CHECK (type IN ('order', 'payment', 'shipped', 'rating', 'system')),
  title      TEXT         NOT NULL,
  message    TEXT         NOT NULL,
  href       TEXT         DEFAULT NULL,
  read_at    DATETIME     DEFAULT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_notifications PRIMARY KEY (id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 12. COMPLAINTS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).

CREATE TABLE IF NOT EXISTS complaints (
  id              CHAR(36)     NOT NULL,
  order_id        CHAR(36)     NOT NULL,
  buyer_id        CHAR(36)     NOT NULL,
  seller_id       CHAR(36)     NOT NULL,
  type            VARCHAR(50)  NOT NULL CHECK (type IN ('damaged', 'missing_item', 'wrong_item', 'not_received', 'other')),
  description     TEXT         NOT NULL,
  status          VARCHAR(30)  NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'seller_replied', 'admin_review', 'resolved', 'rejected')),
  seller_response TEXT         DEFAULT NULL,
  admin_notes     TEXT         DEFAULT NULL,
  resolution      TEXT         DEFAULT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_complaints PRIMARY KEY (id),
  CONSTRAINT fk_complaints_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_complaints_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_complaints_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE INDEX idx_complaints_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 13. ORDER_CHAT_MESSAGES
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).
--   Catatan: RLS policies dari Supabase dihapus. Otorisasi dipindah ke backend app layer.

CREATE TABLE IF NOT EXISTS order_chat_messages (
  id         CHAR(36)  NOT NULL,
  order_id   CHAR(36)  NOT NULL,
  sender_id  CHAR(36)  NOT NULL,
  content    TEXT      NOT NULL,
  created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_order_chat_messages PRIMARY KEY (id),
  CONSTRAINT fk_ocm_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_ocm_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ocm_order_created (order_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 14. PRODUCT_CHAT_THREADS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).

CREATE TABLE IF NOT EXISTS product_chat_threads (
  id         CHAR(36)  NOT NULL,
  product_id CHAR(36)  NOT NULL,
  buyer_id   CHAR(36)  NOT NULL,
  seller_id  CHAR(36)  NOT NULL,
  created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_product_chat_threads PRIMARY KEY (id),
  CONSTRAINT fk_pct_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pct_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pct_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_pct_product_buyer_seller UNIQUE (product_id, buyer_id, seller_id),
  CONSTRAINT chk_pct_no_self CHECK (buyer_id <> seller_id),
  INDEX idx_pct_buyer_updated (buyer_id, updated_at DESC),
  INDEX idx_pct_seller_updated (seller_id, updated_at DESC),
  INDEX idx_pct_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 15. PRODUCT_CHAT_MESSAGES
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).

CREATE TABLE IF NOT EXISTS product_chat_messages (
  id         CHAR(36)  NOT NULL,
  thread_id  CHAR(36)  NOT NULL,
  sender_id  CHAR(36)  NOT NULL,
  content    TEXT      NOT NULL,
  created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_product_chat_messages PRIMARY KEY (id),
  CONSTRAINT fk_pcm_thread FOREIGN KEY (thread_id) REFERENCES product_chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT fk_pcm_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_pcm_thread_created (thread_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 16. PRODUCT_ADS
-- ============================================================
-- 3NF: ⚠️  `total_price` bisa derived dari price_per_day × jumlah hari,
--   tapi disimpan sebagai snapshot. Acceptable untuk marketplace.

CREATE TABLE IF NOT EXISTS product_ads (
  id               CHAR(36)     NOT NULL,
  product_id       CHAR(36)     NOT NULL,
  seller_id        CHAR(36)     NOT NULL,
  start_date       DATETIME     NOT NULL,
  end_date         DATETIME     NOT NULL,
  price_per_day    INT          NOT NULL DEFAULT 5000 CHECK (price_per_day >= 0),
  total_price      INT          NOT NULL CHECK (total_price >= 0),
  status           VARCHAR(30)  NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'scheduled', 'active', 'paused', 'completed', 'rejected')),
  payment_status   VARCHAR(20)  NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  transaction_id   VARCHAR(255) DEFAULT NULL,
  placement        VARCHAR(50)  NOT NULL DEFAULT 'home_carousel',
  title            VARCHAR(255) DEFAULT NULL,
  caption          VARCHAR(500) DEFAULT NULL,
  target_url       VARCHAR(500) DEFAULT NULL,
  rejection_reason TEXT         DEFAULT NULL,
  paused_reason    TEXT         DEFAULT NULL,
  reviewed_by      CHAR(36)     DEFAULT NULL,
  reviewed_at      DATETIME     DEFAULT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_product_ads PRIMARY KEY (id),
  CONSTRAINT fk_pa_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 17. AD_ANALYTICS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id). 1:1 dengan product_ads.

CREATE TABLE IF NOT EXISTS ad_analytics (
  id               CHAR(36)  NOT NULL,
  ad_id            CHAR(36)  NOT NULL,
  views_count      INT       NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  clicks_count     INT       NOT NULL DEFAULT 0 CHECK (clicks_count >= 0),
  last_recorded_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_ad_analytics PRIMARY KEY (id),
  CONSTRAINT uq_ad_analytics_ad UNIQUE (ad_id),
  CONSTRAINT fk_aa_ad FOREIGN KEY (ad_id) REFERENCES product_ads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 18. MARKETPLACE_BANNERS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).

CREATE TABLE IF NOT EXISTS marketplace_banners (
  id          CHAR(36)     NOT NULL,
  title       VARCHAR(255) NOT NULL,
  subtitle    VARCHAR(255) DEFAULT NULL,
  image_url   TEXT         NOT NULL,
  target_url  TEXT         DEFAULT NULL,
  placement   VARCHAR(50)  NOT NULL DEFAULT 'home_carousel',
  start_time  DATETIME     NOT NULL,
  end_time    DATETIME     NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_by  CHAR(36)     DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_marketplace_banners PRIMARY KEY (id),
  CONSTRAINT fk_mb_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 19. BANNER_ANALYTICS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id). 1:1 dengan marketplace_banners.

CREATE TABLE IF NOT EXISTS banner_analytics (
  id               CHAR(36)  NOT NULL,
  banner_id        CHAR(36)  NOT NULL,
  views_count      INT       NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  clicks_count     INT       NOT NULL DEFAULT 0 CHECK (clicks_count >= 0),
  last_recorded_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_banner_analytics PRIMARY KEY (id),
  CONSTRAINT uq_ba_banner UNIQUE (banner_id),
  CONSTRAINT fk_ba_banner FOREIGN KEY (banner_id) REFERENCES marketplace_banners(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 20. USER_VOUCHERS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).

CREATE TABLE IF NOT EXISTS user_vouchers (
  id              CHAR(36)    NOT NULL,
  user_id         CHAR(36)    NOT NULL,
  voucher_id      CHAR(36)    NOT NULL,
  order_id        CHAR(36)    DEFAULT NULL,
  used_at         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status          VARCHAR(20) NOT NULL DEFAULT 'used' CHECK (status IN ('reserved', 'used', 'released')),
  reserved_at     DATETIME    DEFAULT NULL,
  released_at     DATETIME    DEFAULT NULL,
  idempotency_key CHAR(36)    DEFAULT NULL,

  CONSTRAINT pk_user_vouchers PRIMARY KEY (id),
  CONSTRAINT fk_uv_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uv_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  CONSTRAINT fk_uv_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 21. ORDER_VOUCHERS
-- ============================================================
-- 3NF: ⚠️  `voucher_code` & `discount_type` redundan dengan vouchers table,
--   tapi disimpan sebagai snapshot untuk akurasi historis.

CREATE TABLE IF NOT EXISTS order_vouchers (
  id                CHAR(36)    NOT NULL,
  order_id          CHAR(36)    NOT NULL,
  voucher_id        CHAR(36)    NOT NULL,
  voucher_code      VARCHAR(50) NOT NULL,
  scope             VARCHAR(20) NOT NULL CHECK (scope IN ('marketplace', 'seller')),
  seller_id         CHAR(36)    DEFAULT NULL,
  discount_type     VARCHAR(30) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_marketplace_fee')),
  discount_amount   INT         NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  eligible_subtotal INT         NOT NULL DEFAULT 0 CHECK (eligible_subtotal >= 0),
  created_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_order_vouchers PRIMARY KEY (id),
  CONSTRAINT fk_ov_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_ov_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  CONSTRAINT fk_ov_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 22. ADMIN_AUDIT_LOGS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).
--   `before_data` & `after_data` dikonversi dari JSONB ke JSON.

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id         CHAR(36)  NOT NULL,
  actor_id   CHAR(36)  NOT NULL,
  action     TEXT      NOT NULL,
  target_type VARCHAR(100) NOT NULL,
  target_id  CHAR(36)  DEFAULT NULL,
  reason     TEXT      DEFAULT NULL,
  before_data JSON    DEFAULT NULL,
  after_data  JSON    DEFAULT NULL,
  created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_admin_audit_logs PRIMARY KEY (id),
  CONSTRAINT fk_aal_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_aal_created (created_at DESC),
  INDEX idx_aal_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 23. INTEGRATION_LOGS
-- ============================================================
-- 3NF: ✅ Semua kolom bergantung pada PK (id).

CREATE TABLE IF NOT EXISTS integration_logs (
  id          CHAR(36)     NOT NULL,
  service     VARCHAR(100) NOT NULL,
  operation   VARCHAR(100) NOT NULL,
  success     TINYINT(1)   NOT NULL,
  duration_ms INT          NOT NULL CHECK (duration_ms >= 0),
  order_id    CHAR(36)     DEFAULT NULL,
  status_code INT          DEFAULT NULL,
  error_code  TEXT         DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_integration_logs PRIMARY KEY (id),
  CONSTRAINT fk_il_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_il_created (created_at DESC),
  INDEX idx_il_service_created (service, created_at DESC),
  INDEX idx_il_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- SELESAI — 23 tabel terbuat
-- ============================================================
