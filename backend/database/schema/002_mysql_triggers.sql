-- ============================================================
-- PasarKita — MySQL Triggers
-- Migrasi dari PostgreSQL trigger functions ke MySQL 8.0+
-- ============================================================

DELIMITER $$

-- ------------------------------------------------------------
-- 1. touch_product_chat_thread
--    Auto-update updated_at pada product_chat_messages insert
--    (Menggantikan PL/pgSQL trigger function)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_product_chat_messages_touch_thread$$
CREATE TRIGGER trg_product_chat_messages_touch_thread
AFTER INSERT ON product_chat_messages
FOR EACH ROW
BEGIN
  UPDATE product_chat_threads
  SET updated_at = NOW()
  WHERE id = NEW.thread_id;
END$$


-- ------------------------------------------------------------
-- 2. record_order_status_event
--    Auto-record order status history + create notification
--    (Menggantikan PL/pgSQL trigger function)
--    Catatan: MySQL trigger tidak bisa INSERT ke tabel lain
--    yang sedang di-trigger, jadi history dicatat di sini,
--    notification dibuat oleh application layer.
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_orders_record_status_event$$
CREATE TRIGGER trg_orders_record_status_event
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
  INSERT INTO order_status_history (id, order_id, status, source, note, created_at)
  VALUES (
    UUID(),
    NEW.id,
    NEW.status,
    'checkout',
    'Order dibuat dan menunggu hasil pembayaran.',
    NEW.created_at
  );
END$$


DROP TRIGGER IF EXISTS trg_orders_record_status_update$$
CREATE TRIGGER trg_orders_record_status_update
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO order_status_history (id, order_id, status, source, note, created_at)
    VALUES (
      UUID(),
      NEW.id,
      NEW.status,
      'order_update',
      CASE NEW.status
        WHEN 'paid' THEN 'Pembayaran berhasil dikonfirmasi.'
        WHEN 'processing' THEN 'Penjual mulai menyiapkan pesanan.'
        WHEN 'payment_failed' THEN 'Pembayaran gagal dikonfirmasi.'
        WHEN 'shipped' THEN 'Pesanan telah diserahkan untuk pengiriman.'
        WHEN 'delivered' THEN 'Pesanan telah dikonfirmasi diterima.'
        WHEN 'cancelled' THEN 'Pesanan telah dibatalkan.'
        ELSE 'Status pesanan diperbarui.'
      END,
      NOW()
    );
  END IF;
END$$


-- ------------------------------------------------------------
-- 3. set_order_fulfillment_timestamps
--    Auto-set processing_at dan shipped_at
--    (Menggantikan PL/pgSQL trigger function)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_orders_set_fulfillment_timestamps$$
CREATE TRIGGER trg_orders_set_fulfillment_timestamps
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
  IF NEW.status = 'processing' AND OLD.status != 'processing' AND NEW.processing_at IS NULL THEN
    SET NEW.processing_at = NOW();
  END IF;
  IF NEW.status = 'shipped' AND OLD.status != 'shipped' AND NEW.shipped_at IS NULL THEN
    SET NEW.shipped_at = NOW();
  END IF;
END$$


DELIMITER ;
