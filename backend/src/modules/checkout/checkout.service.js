const pool = require('../../config/mysql');
const { sendPaymentRequest } = require('../../integrations/smartbank');
const { triggerShipping } = require('../../integrations/logistikita');
const { notifySellerNewOrder, notifySellerLowStock } = require('../notifications/notification.service');
const { AppError } = require('../../utils/app-error');
const { ORDER_STATUS } = require('../../constants');

const mapCheckoutProcedureError = (error) => {
  const message = error?.sqlMessage || error?.message || 'Checkout gagal';
  const [code, ...parts] = message.split(':');

  if (code === 'INSUFFICIENT_STOCK') {
    const [productName, available, requested] = parts;
    return new AppError(
      400,
      'INSUFFICIENT_STOCK',
      'Stok tidak mencukupi',
      `Produk '${productName || 'tidak diketahui'}': stok tersedia ${available || 0}, diminta ${requested || 0}`
    );
  }

  const knownErrors = {
    IDEMPOTENCY_KEY_REQUIRED: [400, 'VALIDATION_ERROR', 'Idempotency key wajib dikirim'],
    INVALID_SHIPPING_ADDRESS: [400, 'VALIDATION_ERROR', 'Alamat pengiriman tidak valid (min 10 karakter)'],
    ITEMS_REQUIRED: [400, 'VALIDATION_ERROR', 'Items tidak boleh kosong'],
    DUPLICATE_PRODUCTS: [400, 'VALIDATION_ERROR', 'Produk duplikat harus digabung menjadi satu item'],
    CHECKOUT_LOCK_TIMEOUT: [409, 'CHECKOUT_IN_PROGRESS', 'Checkout yang sama sedang diproses'],
    INVALID_QUANTITY: [400, 'VALIDATION_ERROR', 'Kuantitas produk tidak valid'],
    PRODUCT_NOT_FOUND: [404, 'NOT_FOUND', 'Produk tidak ditemukan'],
  };

  const mapped = knownErrors[code];
  if (mapped) {
    return new AppError(mapped[0], mapped[1], mapped[2], parts.join(':') || null);
  }

  return new AppError(error?.status || 500, error?.code || 'CHECKOUT_FAILED', message);
};

const validateCheckoutPayload = (payload) => {
  const { items, shipping_address } = payload;
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Items tidak boleh kosong');
  }
  if (!shipping_address || shipping_address.trim().length < 10) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Alamat pengiriman tidak valid (min 10 karakter)');
  }
  if (!payload.idempotency_key) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Idempotency key wajib dikirim');
  }
};

const firstCallResult = (rows) => {
  if (Array.isArray(rows?.[0])) return rows[0][0] || null;
  return rows?.[0] || null;
};

const createCheckoutOrder = async (buyerId, payload) => {
  try {
    const [rows] = await pool.query(
      'CALL sp_create_checkout_order(?, ?, ?, ?)',
      [
        buyerId,
        payload.idempotency_key,
        payload.shipping_address.trim(),
        JSON.stringify(payload.items),
      ]
    );
    const result = firstCallResult(rows);
    if (!result?.order) {
      throw new AppError(500, 'CHECKOUT_FAILED', 'Stored procedure tidak mengembalikan order id');
    }
    return { orderId: result.order, created: Boolean(Number(result.created)) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw mapCheckoutProcedureError(error);
  }
};

const getCheckoutOrder = async (orderId) => {
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = rows[0];
  if (!order) {
    throw new AppError(404, 'NOT_FOUND', 'Order tidak ditemukan setelah checkout');
  }
  return order;
};

const getCheckoutOrderItems = async (orderId) => {
  const [items] = await pool.query(
    `SELECT oi.order_id, oi.product_id, oi.qty, oi.price_at_purchase, oi.product_name_at_purchase,
            p.name AS product_name, p.seller_id, p.stock, p.minimum_stock
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [orderId]
  );
  return items;
};

const notifyLowStockAfterReservation = (orderItems) => {
  for (const item of orderItems) {
    if (!item.seller_id) continue;
    void notifySellerLowStock(
      item.product_id,
      item.product_name_at_purchase || item.product_name,
      item.seller_id,
      Number(item.stock || 0),
      Number(item.minimum_stock || 5)
    );
  }
};

const executePayment = async (order, buyerId, orderItems) => {
  const paymentResult = await sendPaymentRequest({
    orderId: order.id,
    fromUser: buyerId,
    amount: order.total,
    feeMarketplace: order.fee_marketplace,
    items: orderItems.map(i => ({ product_id: i.product_id, qty: i.qty }))
  });
  return paymentResult.data?.transaction_id ?? null;
};

const syncShippingForPaidOrder = async (order, itemCount) => {
  let trackingId = null;
  let trackingStatus = 'pending';

  try {
    const shippingResult = await triggerShipping({
      orderId: order.id,
      fromAddress: 'Gudang PasarKita',
      toAddress: order.shipping_address,
      itemsCount: itemCount
    });
    trackingId = shippingResult.data?.tracking_id ?? null;
    trackingStatus = shippingResult.data?.status ?? 'created';
    if (trackingId) {
      await pool.query(
        "UPDATE orders SET tracking_id = ?, shipping_sync_status = 'synced', shipping_sync_error = NULL, shipping_sync_updated_at = NOW() WHERE id = ?",
        [trackingId, order.id]
      );
    }
  } catch (logisticsErr) {
    console.error('[Checkout] LogistiKita gagal (order tetap paid):', logisticsErr.message);
    await pool.query(
      "UPDATE orders SET shipping_sync_status = 'failed', shipping_sync_error = ?, shipping_sync_updated_at = NOW() WHERE id = ?",
      [logisticsErr.message || 'LogistiKita tidak merespons', order.id]
    );
  }

  return { tracking_id: trackingId, status: trackingStatus };
};

const markOrderPaid = async (orderId, transactionId) => {
  await pool.query(
    'UPDATE orders SET status = ?, transaction_id = ? WHERE id = ?',
    [ORDER_STATUS.PAID, transactionId, orderId]
  );
};

const failOrderAndReleaseStock = async (orderId) => {
  await pool.query('UPDATE orders SET status = ? WHERE id = ?', [ORDER_STATUS.PAYMENT_FAILED, orderId]);
  try {
    await pool.query('CALL sp_release_checkout_stock(?)', [orderId]);
  } catch (error) {
    console.error('[Checkout] Gagal melepas stok setelah payment gagal:', error.message);
  }
};

const buildCheckoutResponse = (order, transactionId, shipping, idempotentReplay = false) => ({
  order_id: order.id,
  status: order.status,
  subtotal: order.subtotal,
  fee_marketplace: order.fee_marketplace,
  total: order.total,
  transaction_id: transactionId ?? order.transaction_id ?? null,
  shipping,
  hardening_active: true,
  idempotent_replay: idempotentReplay,
});

const processCheckout = async (buyerId, payload) => {
  validateCheckoutPayload(payload);

  const { orderId, created } = await createCheckoutOrder(buyerId, payload);
  let order = await getCheckoutOrder(orderId);
  const orderItems = await getCheckoutOrderItems(orderId);

  if (!created) {
    return buildCheckoutResponse(order, order.transaction_id, {
      tracking_id: order.tracking_id ?? null,
      status: order.shipping_sync_status ?? null,
    }, true);
  }

  notifyLowStockAfterReservation(orderItems);

  try {
    const transactionId = await executePayment(order, buyerId, orderItems);
    await markOrderPaid(order.id, transactionId);
    order = await getCheckoutOrder(order.id);
    void notifySellerNewOrder(order.id, orderItems);

    const itemCount = orderItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const shipping = await syncShippingForPaidOrder(order, itemCount);

    return buildCheckoutResponse(order, transactionId, shipping);
  } catch (paymentErr) {
    console.error('[Checkout] Payment gagal:', paymentErr);
    await failOrderAndReleaseStock(order.id);
    throw new AppError(
      paymentErr.status ?? 402,
      paymentErr.code ?? 'PAYMENT_FAILED',
      paymentErr.message ?? 'Pembayaran gagal'
    );
  }
};

module.exports = { processCheckout };
