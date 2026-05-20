const supabase = require('../../config/supabase');
const { calculateFee } = require('../../utils/fee');
const { sendPaymentRequest } = require('../../integrations/smartbank');
const { triggerShipping } = require('../../integrations/logistikita');

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
const processCheckout = async (buyerId, payload) => {
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
    await supabase
      .from('products')
      .update({ stock: newStock, ...(newStock <= 0 ? { is_active: false } : {}) })
      .eq('id', item.product_id);
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
          .update({ tracking_id: trackingId })
          .eq('id', order.id);
      }
    } catch (logisticsErr) {
      // LogistiKita gagal tidak membatalkan order — order tetap 'paid'
      // Admin bisa trigger ulang secara manual
      console.error('[Checkout] LogistiKita gagal (order tetap paid):', logisticsErr.message);
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

module.exports = { processCheckout };
