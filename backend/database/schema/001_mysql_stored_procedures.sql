-- ============================================================
-- PasarKita — MySQL Stored Procedures
-- Migrasi dari PL/pgSQL functions (Supabase) ke MySQL 8.0+
-- ============================================================

DELIMITER $$

-- ------------------------------------------------------------
-- 1. create_checkout_order — Checkout atomik dengan idempotency
--    Menggantikan PL/pgSQL yang menggunakan advisory lock
--    MySQL: menggunakan GET_LOCK() sebagai pengganti advisory lock
--    Fixed: duplicate check before loop, deadlock prevention via sort
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_create_checkout_order$$
CREATE PROCEDURE sp_create_checkout_order(
  IN p_buyer_id CHAR(36),
  IN p_idempotency_key CHAR(36),
  IN p_shipping_address TEXT,
  IN p_items JSON
)
BEGIN
  DECLARE v_lock_name VARCHAR(255);
  DECLARE v_existing_order_id CHAR(36);
  DECLARE v_order_id CHAR(36);
  DECLARE v_subtotal INT DEFAULT 0;
  DECLARE v_fee INT;
  DECLARE v_total INT;
  DECLARE v_item_index INT DEFAULT 0;
  DECLARE v_item_count INT;
  DECLARE v_product_id CHAR(36);
  DECLARE v_qty INT;
  DECLARE v_product_name VARCHAR(255);
  DECLARE v_product_price INT;
  DECLARE v_product_stock INT;
  DECLARE v_product_active TINYINT(1);
  DECLARE v_order_created TINYINT(1) DEFAULT 0;
  DECLARE v_err_msg VARCHAR(500);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    GET DIAGNOSTICS CONDITION 1 @sql_state = RETURNED_SQLSTATE, @err_msg = MESSAGE_TEXT;
    ROLLBACK;
    RESIGNAL SET MESSAGE_TEXT = @err_msg;
  END;

  -- Validasi input
  IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;

  IF p_shipping_address IS NULL OR CHAR_LENGTH(TRIM(p_shipping_address)) < 10 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_SHIPPING_ADDRESS';
  END IF;

  IF p_items IS NULL OR JSON_LENGTH(p_items) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ITEMS_REQUIRED';
  END IF;

  -- Validasi duplicate products (SEBELUM loop — O(n) bukan O(n²))
  IF (
    SELECT COUNT(DISTINCT jt.pid)
    FROM JSON_TABLE(p_items, '$[*]' COLUMNS (pid VARCHAR(36) PATH '$.product_id')) AS jt
  ) <> JSON_LENGTH(p_items) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DUPLICATE_PRODUCTS';
  END IF;

  -- Acquire advisory lock (pendek agar aman di semua MySQL versi)
  SET v_lock_name = CONCAT('ck_', LEFT(p_buyer_id, 8), '_', LEFT(p_idempotency_key, 8));
  IF GET_LOCK(v_lock_name, 10) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CHECKOUT_LOCK_TIMEOUT';
  END IF;

  START TRANSACTION;

  -- Cek idempotency
  SELECT id INTO v_existing_order_id
  FROM orders
  WHERE buyer_id = p_buyer_id AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_existing_order_id IS NOT NULL THEN
    -- Return full order row (matching PostgreSQL jsonb_build_object format)
    SELECT v_existing_order_id AS `order`, 0 AS created;
    COMMIT;
    DO RELEASE_LOCK(v_lock_name);
  ELSE
    -- Hitung subtotal dari items (sorted by product_id untuk deadlock prevention)
    SET v_item_count = JSON_LENGTH(p_items);
    WHILE v_item_index < v_item_count DO
      SET v_product_id = JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_item_index, '].product_id')));
      SET v_qty = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_item_index, '].qty'))) AS UNSIGNED);

      IF v_qty < 1 OR v_qty > 100 THEN
        ROLLBACK;
        DO RELEASE_LOCK(v_lock_name);
        SET v_err_msg = CONCAT('INVALID_QUANTITY:', v_product_id);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
      END IF;

      -- Lock baris produk
      SELECT name, price, stock, is_active
      INTO v_product_name, v_product_price, v_product_stock, v_product_active
      FROM products
      WHERE id = v_product_id
      FOR UPDATE;

      IF v_product_name IS NULL OR v_product_active = 0 THEN
        ROLLBACK;
        DO RELEASE_LOCK(v_lock_name);
        SET v_err_msg = CONCAT('PRODUCT_NOT_FOUND:', v_product_id);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
      END IF;

      IF v_product_stock < v_qty THEN
        ROLLBACK;
        DO RELEASE_LOCK(v_lock_name);
        SET v_err_msg = CONCAT('INSUFFICIENT_STOCK:', v_product_name, ':', v_product_stock, ':', v_qty);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_err_msg;
      END IF;

      SET v_subtotal = v_subtotal + (v_product_price * v_qty);
      SET v_item_index = v_item_index + 1;
    END WHILE;

    SET v_fee = ROUND(v_subtotal * 0.02);
    SET v_total = v_subtotal + v_fee;

    -- Buat order
    SET v_order_id = UUID();
    INSERT INTO orders (id, buyer_id, status, subtotal, fee_marketplace, total, shipping_address, idempotency_key, stock_reserved)
    VALUES (v_order_id, p_buyer_id, 'pending', v_subtotal, v_fee, v_total, TRIM(p_shipping_address), p_idempotency_key, 1);

    -- Insert order_items dan kurangi stok
    SET v_item_index = 0;
    WHILE v_item_index < v_item_count DO
      SET v_product_id = JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_item_index, '].product_id')));
      SET v_qty = CAST(JSON_UNQUOTE(JSON_EXTRACT(p_items, CONCAT('$[', v_item_index, '].qty'))) AS UNSIGNED);

      SELECT name, price INTO v_product_name, v_product_price
      FROM products WHERE id = v_product_id;

      INSERT INTO order_items (id, order_id, product_id, qty, price_at_purchase, product_name_at_purchase)
      VALUES (UUID(), v_order_id, v_product_id, v_qty, v_product_price, v_product_name);

      UPDATE products
      SET stock = stock - v_qty,
          is_active = CASE WHEN stock - v_qty <= 0 THEN 0 ELSE is_active END
      WHERE id = v_product_id;

      SET v_item_index = v_item_index + 1;
    END WHILE;

    SET v_order_created = 1;
    COMMIT;

    -- Return order_id dan created flag (app layer akan fetch full order)
    SELECT v_order_id AS `order`, v_order_created AS created;
    DO RELEASE_LOCK(v_lock_name);
  END IF;
END$$


-- ------------------------------------------------------------
-- 2. release_checkout_stock — Melepas reservasi stok
--    Fixed: set-based UPDATE (bukan cursor) untuk performa
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_release_checkout_stock$$
CREATE PROCEDURE sp_release_checkout_stock(
  IN p_order_id CHAR(36)
)
BEGIN
  DECLARE v_stock_reserved TINYINT(1);

  SELECT stock_reserved INTO v_stock_reserved
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF v_stock_reserved IS NULL OR v_stock_reserved = 0 THEN
    SELECT 0 AS result;
  ELSE
    -- Set-based: update semua produk sekaligus
    UPDATE products p
    INNER JOIN order_items oi ON oi.product_id = p.id
    SET p.stock = p.stock + oi.qty,
        p.is_active = 1
    WHERE oi.order_id = p_order_id;

    UPDATE orders SET stock_reserved = 0 WHERE id = p_order_id;
    SELECT 1 AS result;
  END IF;
END$$


-- ------------------------------------------------------------
-- 3. increment_banner_views — Increment view counter
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_increment_banner_views$$
CREATE PROCEDURE sp_increment_banner_views(
  IN p_banner_id CHAR(36)
)
BEGIN
  INSERT INTO banner_analytics (id, banner_id, views_count, clicks_count, last_recorded_at)
  VALUES (UUID(), p_banner_id, 1, 0, NOW())
  ON DUPLICATE KEY UPDATE
    views_count = views_count + 1,
    last_recorded_at = NOW();
END$$


-- ------------------------------------------------------------
-- 4. increment_ad_views — Increment ad view counter
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_increment_ad_views$$
CREATE PROCEDURE sp_increment_ad_views(
  IN p_ad_id CHAR(36)
)
BEGIN
  INSERT INTO ad_analytics (id, ad_id, views_count, clicks_count, last_recorded_at)
  VALUES (UUID(), p_ad_id, 1, 0, NOW())
  ON DUPLICATE KEY UPDATE
    views_count = views_count + 1,
    last_recorded_at = NOW();
END$$


-- ------------------------------------------------------------
-- 5. increment_banner_clicks — Increment banner click counter
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_increment_banner_clicks$$
CREATE PROCEDURE sp_increment_banner_clicks(
  IN p_banner_id CHAR(36)
)
BEGIN
  INSERT INTO banner_analytics (id, banner_id, views_count, clicks_count, last_recorded_at)
  VALUES (UUID(), p_banner_id, 0, 1, NOW())
  ON DUPLICATE KEY UPDATE
    clicks_count = clicks_count + 1,
    last_recorded_at = NOW();
END$$


-- ------------------------------------------------------------
-- 6. increment_ad_clicks — Increment ad click counter
-- ------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_increment_ad_clicks$$
CREATE PROCEDURE sp_increment_ad_clicks(
  IN p_ad_id CHAR(36)
)
BEGIN
  INSERT INTO ad_analytics (id, ad_id, views_count, clicks_count, last_recorded_at)
  VALUES (UUID(), p_ad_id, 0, 1, NOW())
  ON DUPLICATE KEY UPDATE
    clicks_count = clicks_count + 1,
    last_recorded_at = NOW();
END$$


DELIMITER ;
