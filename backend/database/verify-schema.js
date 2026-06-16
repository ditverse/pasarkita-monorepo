require('dotenv').config();
const supabase = require('../src/config/supabase');

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

async function main() {
  let failed = false;

  for (const [table, columns] of checks) {
    const { error } = await supabase.from(table).select(columns).limit(1);
    if (error) {
      failed = true;
      console.error(`[GAGAL] ${table}: ${error.message}`);
    } else {
      console.log(`[OK] ${table}`);
    }
  }

  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  const imageBucket = buckets?.find((bucket) => bucket.id === 'product-images');
  if (bucketError || !imageBucket) {
    failed = true;
    console.error(`[GAGAL] bucket product-images: ${bucketError?.message || 'tidak ditemukan'}`);
  } else {
    console.log(`[OK] bucket product-images (${imageBucket.public ? 'public' : 'private'})`);
  }
  const storeBucket = buckets?.find((bucket) => bucket.id === 'store-assets');
  if (bucketError || !storeBucket) {
    failed = true;
    console.error(`[GAGAL] bucket store-assets: ${bucketError?.message || 'tidak ditemukan'}`);
  } else {
    console.log(`[OK] bucket store-assets (${storeBucket.public ? 'public' : 'private'})`);
  }

  const { error: rpcError } = await supabase.rpc('create_checkout_order', {
    p_buyer_id: '00000000-0000-0000-0000-000000000000',
    p_idempotency_key: '00000000-0000-0000-0000-000000000000',
    p_shipping_address: 'schema verification only',
    p_items: [],
  });
  if (rpcError?.code === 'PGRST202') {
    failed = true;
    console.error('[GAGAL] RPC create_checkout_order belum tersedia');
  } else {
    console.log('[OK] RPC create_checkout_order tersedia');
  }

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
