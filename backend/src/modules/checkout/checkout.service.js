const supabase = require('../../config/supabase');
const { calculateFee } = require('../../utils/fee');
const { sendPaymentRequest } = require('../../integrations/smartbank');
const { triggerShipping } = require('../../integrations/logistikita');
const { notifySellerNewOrder, notifySellerLowStock } = require('../notifications/notification.service');
const { quotePromotions } = require('../promotions/promotion.service');

/**
 * Proses checkout multi-item.
 * payload: { items: [{ product_id, qty }], shipping_address }
 *
 * Alur:
 * 1. Validasi stok semua item
 * 2. Hitung subtotal + fee
 * 3. Buat order status 'pending'
 * 4. Insert order_items
 * 5. Kurangi stok
 * 6. Kirim payment ke SmartBank
 *    - Sukses → update order ke 'paid', trigger LogistiKita
 *    - Gagal  → update order ke 'payment_failed', rollback stok
 */
const processLegacyCheckout = async (buyerId, payload) => {
  const { items, shipping_address } = payload;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Items tidak boleh kosong' };
  }
  if (!shipping_address || shipping_address.trim().length < 10) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Alamat pengiriman tidak valid (min 10 karakter)' };
  }

  // ── 1. Ambil & validasi produk ──────────────────────────────
  const productIds = items.map((i) => i.product_id);
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, price, stock, is_active')
    .in('id', productIds);

  if (prodErr) throw { status: 500, code: 'INTERNAL_ERROR', message: prodErr.message };

  for (const item of items) {
    const product = products.find((p) => p.id === item.product_id);
    if (!product || !product.is_active) {
      throw { status: 404, code: 'NOT_FOUND', message: `Produk tidak ditemukan: ${item.product_id}` };
    }
    if (product.stock < item.qty) {
      throw {
        status: 400,
        code: 'INSUFFICIENT_STOCK',
        message: 'Stok tidak mencukupi',
        details: `Produk '${product.name}': stok tersedia ${product.stock}, diminta ${item.qty}`,
      };
    }
  }

  // ── 2. Hitung harga ─────────────────────────────────────────
  const subtotal = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.product_id);
    return sum + product.price * item.qty;
  }, 0);
  const { fee_marketplace, total } = calculateFee(subtotal);

  // ── 3. Buat order status 'pending' ──────────────────────────
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert([{
      buyer_id: buyerId,
      subtotal,
      fee_marketplace,
      total,
      status: 'pending',
      shipping_address: shipping_address.trim(),
    }])
    .select()
    .single();

  if (orderErr) {
    console.error('Gagal buat order:', orderErr);
    throw { status: 500, code: 'INTERNAL_ERROR', message: 'Gagal membuat order' };
  }

  // ── 4. Insert order_items ───────────────────────────────────
  const orderItems = items.map((item) => {
    const product = products.find((p) => p.id === item.product_id);
    return {
      order_id: order.id,
      product_id: item.product_id,
      qty: item.qty,
      price_at_purchase: product.price,
    };
  });

  const { error: itemErr } = await supabase.from('order_items').insert(orderItems);
  if (itemErr) {
    console.error('Gagal buat order_items:', itemErr);
    await supabase.from('orders').delete().eq('id', order.id);
    throw { status: 500, code: 'INTERNAL_ERROR', message: 'Gagal menyimpan item order' };
  }

  // ── 5. Kurangi stok ─────────────────────────────────────────
  for (const item of items) {
    const product = products.find((p) => p.id === item.product_id);
    const newStock = product.stock - item.qty;
    const { data: updatedProduct } = await supabase
      .from('products')
      .update({ stock: newStock, ...(newStock <= 0 ? { is_active: false } : {}) })
      .eq('id', item.product_id)
      .select('id, name, seller_id, minimum_stock')
      .single();
    // Notifikasi stok menipis/habis (fire-and-forget)
    if (updatedProduct) {
      void notifySellerLowStock(
        updatedProduct.id,
        updatedProduct.name,
        updatedProduct.seller_id,
        newStock,
        updatedProduct.minimum_stock ?? 0
      );
    }
  }

  // ── 6. Kirim payment ke SmartBank ───────────────────────────
  let transactionId = null;
  let trackingId = null;
  let trackingStatus = 'pending';

  try {
    const paymentResult = await sendPaymentRequest({
      orderId: order.id,
      fromUser: buyerId,
      amount: total,
      feeMarketplace: fee_marketplace,
      items: orderItems.map((i) => ({ product_id: i.product_id, qty: i.qty })),
    });

    transactionId = paymentResult.data?.transaction_id ?? null;

    // Payment sukses → update order ke 'paid'
    await supabase
      .from('orders')
      .update({ status: 'paid', transaction_id: transactionId })
      .eq('id', order.id);

    // Notifikasi order masuk ke seller (fire-and-forget)
    void notifySellerNewOrder(order.id, orderItems);

    // ── 7. Trigger LogistiKita ─────────────────────────────────
    try {
      const shippingResult = await triggerShipping({
        orderId: order.id,
        fromAddress: 'Gudang PasarKita',
        toAddress: shipping_address.trim(),
        itemsCount: items.reduce((s, i) => s + i.qty, 0),
      });

      trackingId = shippingResult.data?.tracking_id ?? null;
      trackingStatus = shippingResult.data?.status ?? 'created';

      // Simpan tracking_id ke order
      if (trackingId) {
        await supabase
          .from('orders')
          .update({
            tracking_id: trackingId,
            shipping_sync_status: 'synced',
            shipping_sync_error: null,
            shipping_sync_updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);
      }
    } catch (logisticsErr) {
      // LogistiKita gagal tidak membatalkan order — order tetap 'paid'
      // Admin bisa trigger ulang secara manual
      console.error('[Checkout] LogistiKita gagal (order tetap paid):', logisticsErr.message);
      await supabase
        .from('orders')
        .update({
          shipping_sync_status: 'failed',
          shipping_sync_error: logisticsErr.message || 'LogistiKita tidak merespons',
          shipping_sync_updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
    }

    return {
      order_id: order.id,
      status: 'paid',
      subtotal,
      fee_marketplace,
      total,
      transaction_id: transactionId,
      shipping: {
        tracking_id: trackingId,
        status: trackingStatus,
      },
      hardening_active: false,
      idempotent_replay: false,
    };

  } catch (paymentErr) {
    // Payment gagal → rollback stok + update order ke 'payment_failed'
    console.error('[Checkout] Payment gagal:', paymentErr);

    await supabase
      .from('orders')
      .update({ status: 'payment_failed' })
      .eq('id', order.id);

    // Rollback stok
    for (const item of items) {
      const product = products.find((p) => p.id === item.product_id);
      const restoredStock = product.stock; // stok sebelum dikurangi
      await supabase
        .from('products')
        .update({ stock: restoredStock, is_active: true })
        .eq('id', item.product_id);
    }

    // Teruskan error SmartBank ke controller
    throw {
      status: paymentErr.status ?? 402,
      code: paymentErr.code ?? 'PAYMENT_FAILED',
      message: paymentErr.message ?? 'Pembayaran gagal',
      details: paymentErr.details,
      retry_after: paymentErr.retry_after,
    };
  }
};

const isHardeningUnavailable = (error) =>
  error?.code === 'PGRST202' ||
  error?.code === '42883' ||
  error?.message?.includes('create_checkout_order');

const isPromotionRpcUnavailable = (error) =>
  error?.code === 'PGRST202' ||
  error?.code === '42883' ||
  error?.message?.includes('create_checkout_order_v2');

const hasVoucherInput = (payload) =>
  Boolean(payload.marketplace_voucher_code?.trim()) ||
  (Array.isArray(payload.seller_voucher_codes) && payload.seller_voucher_codes.some((code) => code?.trim()));

const mapAtomicCheckoutError = (error) => {
  const message = error?.message || '';
  if (message.includes('INSUFFICIENT_STOCK')) {
    const [, productName, available, requested] = message.match(/INSUFFICIENT_STOCK:([^:]+):(\d+):(\d+)/) || [];
    return {
      status: 400,
      code: 'INSUFFICIENT_STOCK',
      message: 'Stok tidak mencukupi',
      details: productName
        ? `Produk '${productName}': stok tersedia ${available}, diminta ${requested}`
        : null,
    };
  }
  if (message.includes('PRODUCT_NOT_FOUND')) {
    return { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan atau tidak aktif' };
  }
  if (message.includes('INVALID_QUANTITY') || message.includes('ITEMS_REQUIRED') || message.includes('DUPLICATE_PRODUCTS')) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Item checkout tidak valid' };
  }
  if (message.includes('INVALID_TOTAL')) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Total checkout tidak valid setelah promo' };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Gagal membuat checkout atomik' };
};

const releaseCheckoutResources = async (orderId) => {
  const promoRelease = await supabase.rpc('release_checkout_promotions', { p_order_id: orderId });
  if (!promoRelease.error) return;
  if (!isPromotionRpcUnavailable(promoRelease.error)) {
    console.error('[Checkout] Gagal melepas reservasi promo:', promoRelease.error);
  }

  const stockRelease = await supabase.rpc('release_checkout_stock', { p_order_id: orderId });
  if (stockRelease.error) {
    console.error('[Checkout] Gagal melepas reservasi stok:', stockRelease.error);
  }
};

const markVoucherReservationsUsed = async (orderId) => {
  const { error } = await supabase
    .from('user_vouchers')
    .update({ status: 'used', used_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('status', 'reserved');
  if (error && !['42P01', '42703', 'PGRST204'].includes(error.code)) {
    console.error('[Checkout] Gagal menandai voucher sebagai used:', error);
  }
};

const hasActiveProductPromo = async (payload) => {
  try {
    const quote = await quotePromotions({
      items: payload.items,
      marketplace_voucher_code: null,
      seller_voucher_codes: [],
    });
    return quote.product_discount_total > 0;
  } catch (error) {
    if (error?.status) throw error;
    return false;
  }
};

const processPromotionalCheckout = async (buyerId, payload) => {
  const { data: checkoutResult, error } = await supabase.rpc('create_checkout_order_v2', {
    p_buyer_id: buyerId,
    p_idempotency_key: payload.idempotency_key,
    p_shipping_address: payload.shipping_address.trim(),
    p_items: payload.items,
    p_marketplace_voucher_code: payload.marketplace_voucher_code || null,
    p_seller_voucher_codes: payload.seller_voucher_codes || [],
  });

  if (error) {
    if (isPromotionRpcUnavailable(error)) throw error;
    throw mapAtomicCheckoutError(error);
  }

  const order = checkoutResult?.order;
  if (!order) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: 'Checkout promo tidak mengembalikan order' };
  }

  if (!checkoutResult.created) {
    return {
      order_id: order.id,
      status: order.status,
      subtotal: order.subtotal,
      fee_marketplace: order.fee_marketplace,
      fee_marketplace_base: order.fee_marketplace_base ?? order.fee_marketplace,
      fee_discount: order.fee_discount ?? 0,
      voucher_discount_total: order.voucher_discount_total ?? order.voucher_discount ?? 0,
      discount_total: order.discount_total ?? order.voucher_discount ?? 0,
      total: order.total,
      transaction_id: order.transaction_id,
      shipping: {
        tracking_id: order.tracking_id,
        status: order.tracking_id ? 'created' : 'pending',
      },
      hardening_active: true,
      promo_active: true,
      idempotent_replay: true,
    };
  }

  let transactionId = null;
  let trackingId = null;
  let trackingStatus = 'pending';

  try {
    const paymentResult = await sendPaymentRequest({
      orderId: order.id,
      fromUser: buyerId,
      amount: order.total,
      feeMarketplace: order.fee_marketplace,
      items: payload.items,
    });
    transactionId = paymentResult.data?.transaction_id ?? null;
  } catch (paymentError) {
    await supabase.from('orders').update({ status: 'payment_failed' }).eq('id', order.id);
    await releaseCheckoutResources(order.id);
    throw {
      status: paymentError.status ?? 402,
      code: paymentError.code ?? 'PAYMENT_FAILED',
      message: paymentError.message ?? 'Pembayaran gagal',
      details: paymentError.details,
      retry_after: paymentError.retry_after,
    };
  }

  const { error: paidError } = await supabase
    .from('orders')
    .update({ status: 'paid', transaction_id: transactionId, stock_reserved: false })
    .eq('id', order.id);

  if (paidError) {
    console.error('[Checkout] Payment sukses tetapi order gagal diperbarui:', paidError);
    throw {
      status: 500,
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
      message: 'Pembayaran diterima, tetapi status order perlu direkonsiliasi oleh admin',
      details: `Order ID: ${order.id}`,
    };
  }

  await markVoucherReservationsUsed(order.id);
  void notifySellerNewOrder(order.id, payload.items);

  try {
    const shippingResult = await triggerShipping({
      orderId: order.id,
      fromAddress: 'Gudang PasarKita',
      toAddress: payload.shipping_address.trim(),
      itemsCount: payload.items.reduce((sum, item) => sum + item.qty, 0),
    });
    trackingId = shippingResult.data?.tracking_id ?? null;
    trackingStatus = shippingResult.data?.status ?? 'created';
    if (trackingId) {
      await supabase
        .from('orders')
        .update({
          tracking_id: trackingId,
          shipping_sync_status: 'synced',
          shipping_sync_error: null,
          shipping_sync_updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
    }
  } catch (logisticsError) {
    console.error('[Checkout] LogistiKita gagal (order tetap paid):', logisticsError.message);
    await supabase
      .from('orders')
      .update({
        shipping_sync_status: 'failed',
        shipping_sync_error: logisticsError.message || 'LogistiKita tidak merespons',
        shipping_sync_updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);
  }

  return {
    order_id: order.id,
    status: 'paid',
    subtotal: order.subtotal,
    fee_marketplace: order.fee_marketplace,
    fee_marketplace_base: order.fee_marketplace_base ?? order.fee_marketplace,
    fee_discount: order.fee_discount ?? 0,
    voucher_discount_total: order.voucher_discount_total ?? order.voucher_discount ?? 0,
    discount_total: order.discount_total ?? order.voucher_discount ?? 0,
    total: order.total,
    transaction_id: transactionId,
    shipping: { tracking_id: trackingId, status: trackingStatus },
    hardening_active: true,
    promo_active: true,
    idempotent_replay: false,
  };
};

const processAtomicCheckout = async (buyerId, payload) => {
  const { data: checkoutResult, error } = await supabase.rpc('create_checkout_order', {
    p_buyer_id: buyerId,
    p_idempotency_key: payload.idempotency_key,
    p_shipping_address: payload.shipping_address.trim(),
    p_items: payload.items,
  });

  if (error) {
    if (isHardeningUnavailable(error)) throw error;
    throw mapAtomicCheckoutError(error);
  }

  const order = checkoutResult?.order;
  if (!order) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: 'Checkout atomik tidak mengembalikan order' };
  }

  if (!checkoutResult.created) {
    return {
      order_id: order.id,
      status: order.status,
      subtotal: order.subtotal,
      fee_marketplace: order.fee_marketplace,
      total: order.total,
      transaction_id: order.transaction_id,
      shipping: {
        tracking_id: order.tracking_id,
        status: order.tracking_id ? 'created' : 'pending',
      },
      hardening_active: true,
      idempotent_replay: true,
    };
  }

  let transactionId = null;
  let trackingId = null;
  let trackingStatus = 'pending';

  let paymentResult;
  try {
    paymentResult = await sendPaymentRequest({
      orderId: order.id,
      fromUser: buyerId,
      amount: order.total,
      feeMarketplace: order.fee_marketplace,
      items: payload.items,
    });
  } catch (paymentError) {
    await supabase.from('orders').update({ status: 'payment_failed' }).eq('id', order.id);
    const releaseResult = await supabase.rpc('release_checkout_stock', { p_order_id: order.id });
    if (releaseResult.error) {
      console.error('[Checkout] Gagal melepas reservasi stok:', releaseResult.error);
    }
    throw {
      status: paymentError.status ?? 402,
      code: paymentError.code ?? 'PAYMENT_FAILED',
      message: paymentError.message ?? 'Pembayaran gagal',
      details: paymentError.details,
      retry_after: paymentError.retry_after,
    };
  }

  transactionId = paymentResult.data?.transaction_id ?? null;
  const { error: paidError } = await supabase
    .from('orders')
    .update({ status: 'paid', transaction_id: transactionId, stock_reserved: false })
    .eq('id', order.id);

  if (paidError) {
    console.error('[Checkout] Payment sukses tetapi order gagal diperbarui:', paidError);
    throw {
      status: 500,
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
      message: 'Pembayaran diterima, tetapi status order perlu direkonsiliasi oleh admin',
      details: `Order ID: ${order.id}`,
    };
  }

  // Notifikasi order masuk ke seller (fire-and-forget)
  void notifySellerNewOrder(order.id, payload.items);

  try {
    const shippingResult = await triggerShipping({
      orderId: order.id,
      fromAddress: 'Gudang PasarKita',
      toAddress: payload.shipping_address.trim(),
      itemsCount: payload.items.reduce((sum, item) => sum + item.qty, 0),
    });
    trackingId = shippingResult.data?.tracking_id ?? null;
    trackingStatus = shippingResult.data?.status ?? 'created';
    if (trackingId) {
      await supabase
        .from('orders')
        .update({
          tracking_id: trackingId,
          shipping_sync_status: 'synced',
          shipping_sync_error: null,
          shipping_sync_updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
    }
  } catch (logisticsError) {
    console.error('[Checkout] LogistiKita gagal (order tetap paid):', logisticsError.message);
    await supabase
      .from('orders')
      .update({
        shipping_sync_status: 'failed',
        shipping_sync_error: logisticsError.message || 'LogistiKita tidak merespons',
        shipping_sync_updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);
  }

  return {
    order_id: order.id,
    status: 'paid',
    subtotal: order.subtotal,
    fee_marketplace: order.fee_marketplace,
    total: order.total,
    transaction_id: transactionId,
    shipping: { tracking_id: trackingId, status: trackingStatus },
    hardening_active: true,
    idempotent_replay: false,
  };
};

const processCheckout = async (buyerId, payload) => {
  try {
    return await processPromotionalCheckout(buyerId, payload);
  } catch (error) {
    if (!isPromotionRpcUnavailable(error)) throw error;
    if (hasVoucherInput(payload) || await hasActiveProductPromo(payload)) {
      throw {
        status: 503,
        code: 'PROMOTION_SCHEMA_NOT_READY',
        message: 'Schema promo checkout belum aktif. Jalankan migration 016_promotions_discounts.sql.',
      };
    }
    try {
      return await processAtomicCheckout(buyerId, payload);
    } catch (atomicError) {
      if (!isHardeningUnavailable(atomicError)) throw atomicError;
      console.warn('[Checkout] migration 003_checkout_hardening.sql belum aktif; memakai checkout legacy.');
      return processLegacyCheckout(buyerId, payload);
    }
  }
};

module.exports = { processCheckout };
