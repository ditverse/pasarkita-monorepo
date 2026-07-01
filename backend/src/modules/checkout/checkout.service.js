const pool = require('../../config/mysql');
const { calculateFee } = require('../../utils/fee');
const { sendPaymentRequest } = require('../../integrations/smartbank');
const { triggerShipping } = require('../../integrations/logistikita');
const { notifySellerNewOrder, notifySellerLowStock } = require('../notifications/notification.service');
const { quotePromotions } = require('../promotions/promotion.service');

const processLegacyCheckout = async (buyerId, payload) => {
  const { items, shipping_address } = payload;
  if (!items || !Array.isArray(items) || items.length === 0) throw { status: 400, code: 'VALIDATION_ERROR', message: 'Items tidak boleh kosong' };
  if (!shipping_address || shipping_address.trim().length < 10) throw { status: 400, code: 'VALIDATION_ERROR', message: 'Alamat pengiriman tidak valid (min 10 karakter)' };

  const productIds = items.map(i => i.product_id);
  const [products] = await pool.query(
    `SELECT id, name, price, stock, is_active, seller_id FROM products WHERE id IN (${productIds.map(() => '?').join(',')})`,
    productIds
  );

  for (const item of items) {
    const product = products.find(p => p.id === item.product_id);
    if (!product || !product.is_active) throw { status: 404, code: 'NOT_FOUND', message: `Produk tidak ditemukan: ${item.product_id}` };
    if (product.stock < item.qty) throw { status: 400, code: 'INSUFFICIENT_STOCK', message: 'Stok tidak mencukupi', details: `Produk '${product.name}': stok tersedia ${product.stock}, diminta ${item.qty}` };
  }

  const subtotal = items.reduce((s, item) => { const p = products.find(pr => pr.id === item.product_id); return s + p.price * item.qty; }, 0);
  const { fee_marketplace, total } = calculateFee(subtotal);

  const orderId = require('crypto').randomUUID();
  await pool.query(
    'INSERT INTO orders (id, buyer_id, subtotal, fee_marketplace, total, status, shipping_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [orderId, buyerId, subtotal, fee_marketplace, total, 'pending', shipping_address.trim()]
  );

  const orderItems = items.map(item => {
    const product = products.find(p => p.id === item.product_id);
    return { order_id: orderId, product_id: item.product_id, qty: item.qty, price_at_purchase: product.price, product_name_at_purchase: product.name };
  });

  const values = orderItems.map(oi => `(UUID(), ?, ?, ?, ?, ?)`).join(',');
  const flatParams = orderItems.flatMap(oi => [oi.order_id, oi.product_id, oi.qty, oi.price_at_purchase, oi.product_name_at_purchase]);
  await pool.query(`INSERT INTO order_items (id, order_id, product_id, qty, price_at_purchase, product_name_at_purchase) VALUES ${values}`, flatParams);

  for (const item of items) {
    const product = products.find(p => p.id === item.product_id);
    const newStock = product.stock - item.qty;
    await pool.query(
      'UPDATE products SET stock = ?, is_active = ? WHERE id = ?',
      [newStock, newStock <= 0 ? 0 : 1, item.product_id]
    );
    void notifySellerLowStock(item.product_id, product.name, product.seller_id, newStock, 5);
  }

  let transactionId = null; let trackingId = null; let trackingStatus = 'pending';
  try {
    const paymentResult = await sendPaymentRequest({ orderId, fromUser: buyerId, amount: total, feeMarketplace: fee_marketplace, items: orderItems.map(i => ({ product_id: i.product_id, qty: i.qty })) });
    transactionId = paymentResult.data?.transaction_id ?? null;
    await pool.query("UPDATE orders SET status = 'paid', transaction_id = ? WHERE id = ?", [transactionId, orderId]);
    void notifySellerNewOrder(orderId, orderItems);

    try {
      const shippingResult = await triggerShipping({ orderId, fromAddress: 'Gudang PasarKita', toAddress: shipping_address.trim(), itemsCount: items.reduce((s, i) => s + i.qty, 0) });
      trackingId = shippingResult.data?.tracking_id ?? null;
      trackingStatus = shippingResult.data?.status ?? 'created';
      if (trackingId) {
        await pool.query("UPDATE orders SET tracking_id = ?, shipping_sync_status = 'synced', shipping_sync_error = NULL, shipping_sync_updated_at = NOW() WHERE id = ?", [trackingId, orderId]);
      }
    } catch (logisticsErr) {
      console.error('[Checkout] LogistiKita gagal (order tetap paid):', logisticsErr.message);
      await pool.query("UPDATE orders SET shipping_sync_status = 'failed', shipping_sync_error = ?, shipping_sync_updated_at = NOW() WHERE id = ?", [logisticsErr.message || 'LogistiKita tidak merespons', orderId]);
    }

    return { order_id: orderId, status: 'paid', subtotal, fee_marketplace, total, transaction_id: transactionId, shipping: { tracking_id: trackingId, status: trackingStatus } };
  } catch (paymentErr) {
    console.error('[Checkout] Payment gagal:', paymentErr);
    await pool.query("UPDATE orders SET status = 'payment_failed' WHERE id = ?", [orderId]);
    for (const item of items) {
      const product = products.find(p => p.id === item.product_id);
      await pool.query('UPDATE products SET stock = ?, is_active = 1 WHERE id = ?', [product.stock, item.product_id]);
    }
    throw { status: paymentErr.status ?? 402, code: paymentErr.code ?? 'PAYMENT_FAILED', message: paymentErr.message ?? 'Pembayaran gagal' };
  }
};

const processCheckout = async (buyerId, payload) => {
  return processLegacyCheckout(buyerId, payload);
};

module.exports = { processCheckout };
