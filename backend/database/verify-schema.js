require('dotenv').config();
const pool = require('../src/config/mysql');

const checks = [
  ['users', 'id, name, email, role, is_active, created_at'],
  ['products', 'id, seller_id, name, price, stock, minimum_stock, is_low_stock, image_url'],
  ['orders', 'id, buyer_id, status, idempotency_key, stock_reserved, processing_at, shipped_at, pickup_address_snapshot, shipping_sync_status, shipping_sync_error'],
  ['order_items', 'id, order_id, product_id, price_at_purchase, product_name_at_purchase'],
  ['ratings', 'id, order_id, product_id, buyer_id, rating'],
  ['admin_audit_logs', 'id, actor_id, action, created_at'],
  ['integration_logs', 'id, service, operation, success, created_at'],
  ['order_status_history', 'id, order_id, status, source, created_at'],
  ['notifications', 'id, user_id, order_id, type, title, read_at, created_at'],
  ['seller_profiles', 'seller_id, store_name, logo_url, verification_status, processing_days'],
  ['order_chat_messages', 'id, order_id, sender_id, content, created_at'],
  ['product_chat_threads', 'id, product_id, buyer_id, seller_id, created_at, updated_at'],
  ['product_chat_messages', 'id, thread_id, sender_id, content, created_at'],
];

const storedProcedures = [
  'sp_create_checkout_order',
  'sp_release_checkout_stock',
  'sp_increment_banner_views',
  'sp_increment_ad_views',
  'sp_increment_banner_clicks',
  'sp_increment_ad_clicks',
];

const triggers = [
  'trg_product_chat_messages_touch_thread',
  'trg_orders_record_status_event',
  'trg_orders_record_status_update',
  'trg_orders_set_fulfillment_timestamps',
];

async function main() {
  let failed = false;

  console.log('=== Verifying MySQL Schema ===\n');

  // 1. Check tables
  for (const [table, columns] of checks) {
    try {
      await pool.query(`SELECT ${columns} FROM ${table} LIMIT 1`);
      console.log(`[OK] ${table}`);
    } catch (err) {
      failed = true;
      console.error(`[GAGAL] ${table}: ${err.message}`);
    }
  }

  // 2. Check stored procedures
  console.log('\n=== Verifying Stored Procedures ===\n');
  for (const sp of storedProcedures) {
    try {
      const [rows] = await pool.query(
        "SELECT COUNT(*) as cnt FROM information_schema.routines WHERE routine_schema = ? AND routine_name = ?",
        [process.env.MYSQL_DATABASE, sp]
      );
      if (rows[0].cnt > 0) {
        console.log(`[OK] SP ${sp}`);
      } else {
        failed = true;
        console.error(`[GAGAL] SP ${sp}: tidak ditemukan`);
      }
    } catch (err) {
      failed = true;
      console.error(`[GAGAL] SP ${sp}: ${err.message}`);
    }
  }

  // 3. Check triggers
  console.log('\n=== Verifying Triggers ===\n');
  for (const trg of triggers) {
    try {
      const [rows] = await pool.query(
        "SELECT COUNT(*) as cnt FROM information_schema.triggers WHERE trigger_schema = ? AND trigger_name = ?",
        [process.env.MYSQL_DATABASE, trg]
      );
      if (rows[0].cnt > 0) {
        console.log(`[OK] Trigger ${trg}`);
      } else {
        failed = true;
        console.error(`[GAGAL] Trigger ${trg}: tidak ditemukan`);
      }
    } catch (err) {
      failed = true;
      console.error(`[GAGAL] Trigger ${trg}: ${err.message}`);
    }
  }

  // 4. Check uploads directory
  console.log('\n=== Verifying Storage ===\n');
  const fs = require('fs');
  const pathMod = require('path');
  const uploadBase = pathMod.join(__dirname, '../uploads');
  const uploadDirs = ['product-images', 'store-assets', 'review-images'];
  for (const dir of uploadDirs) {
    if (fs.existsSync(pathMod.join(uploadBase, dir))) {
      console.log(`[OK] ${dir}/ exists`);
    } else {
      console.error(`[GAGAL] ${dir}/ tidak ditemukan`);
    }
  }

  // 5. Summary
  const tableCount = checks.length;
  const spCount = storedProcedures.length;
  const trgCount = triggers.length;
  console.log(`\n=== Summary ===`);
  console.log(`Tables: ${tableCount} | Stored Procedures: ${spCount} | Triggers: ${trgCount}`);

  if (failed) {
    console.error('\n❌ Verifikasi gagal — ada item yang tidak ditemukan.');
    process.exitCode = 1;
  } else {
    console.log('\n✅ Semua komponen database terverifikasi!');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  pool.end();
});
