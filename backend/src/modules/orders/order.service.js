const supabase = require('../../config/supabase');
const { triggerShipping } = require('../../integrations/logistikita');
const axios = require('axios');
const env = require('../../config/env');
const { writeAuditLog, writeIntegrationLog } = require('../../utils/observability');

const getOrders = async (user, query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const offset = (page - 1) * limit;

  let supaQuery = supabase
    .from('orders')
    .select('*, items:order_items(product_id, qty, price_at_purchase, product:products(id, name, seller_id))', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (user.role === 'buyer') {
    supaQuery = supaQuery.eq('buyer_id', user.id);
  }
  // seller dan superadmin lihat semua — filter seller dilakukan di sisi query jika perlu

  if (query.status) {
    supaQuery = supaQuery.eq('status', query.status);
  }

  const { data, error, count } = await supaQuery;

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  // Untuk seller: filter hanya order yang mengandung produk miliknya
  let filtered = data || [];
  if (user.role === 'seller') {
    filtered = filtered.filter((order) =>
      order.items?.some((item) => item.product?.seller_id === user.id)
    );
  }

  const totalPages = Math.ceil((count || 0) / limit);

  return {
    data: filtered,
    pagination: { page, limit, total: filtered.length, total_pages: totalPages },
  };
};

const getOrderById = async (user, orderId) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(product_id, qty, price_at_purchase, product:products(id, name, seller_id)), buyer:users!buyer_id(id, name, email)')
    .eq('id', orderId)
    .single();

  if (error || !data) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Order tidak ditemukan' };
  }

  // Seller hanya bisa lihat order yang mengandung produknya
  if (user.role === 'seller') {
    const hasSellersProduct = data.items?.some((item) => item.product?.seller_id === user.id);
    if (!hasSellersProduct) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Akses ditolak' };
    }
  } else if (user.role !== 'superadmin' && data.buyer_id !== user.id) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Akses ditolak' };
  }

  const reshapedItems = (data.items || []).map((item) => ({
    product_id: item.product_id,
    product_name: item.product?.name ?? 'Produk dihapus',
    qty: item.qty,
    price_at_purchase: item.price_at_purchase,
  }));

  return { ...data, items: reshapedItems };
};

const updateOrderStatus = async (user, orderId, status, reason = null) => {
  // Validasi status yang diizinkan per role
  const sellerAllowed = ['shipped'];
  const buyerAllowed = ['delivered'];
  const adminAllowed = ['pending', 'paid', 'shipped', 'delivered', 'payment_failed'];

  let allowed;
  if (user.role === 'superadmin') allowed = adminAllowed;
  else if (user.role === 'seller') allowed = sellerAllowed;
  else if (user.role === 'buyer') allowed = buyerAllowed;
  else allowed = [];

  if (!allowed.includes(status)) {
    throw {
      status: 403,
      code: 'FORBIDDEN',
      message: user.role === 'seller'
        ? 'Seller hanya bisa mengubah status ke "shipped"'
        : user.role === 'buyer'
          ? 'Buyer hanya bisa mengkonfirmasi pesanan diterima'
          : `Status tidak valid. Pilihan: ${adminAllowed.join(', ')}`,
    };
  }
  if (user.role === 'superadmin' && (!reason || reason.trim().length < 3)) {
    throw {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Alasan perubahan status wajib diisi oleh admin',
    };
  }

  // Ambil order untuk validasi kepemilikan
  const { data: order, error: findErr } = await supabase
    .from('orders')
    .select('*, items:order_items(product_id, product:products(seller_id))')
    .eq('id', orderId)
    .single();

  if (findErr || !order) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Order tidak ditemukan' };
  }

  // Seller hanya bisa update order yang mengandung produknya
  if (user.role === 'seller') {
    const hasSellersProduct = order.items?.some((item) => item.product?.seller_id === user.id);
    if (!hasSellersProduct) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Akses ditolak' };
    }

    // Order harus dalam status 'paid' untuk bisa di-shipped
    if (order.status !== 'paid') {
      throw { status: 400, code: 'INVALID_STATUS', message: 'Order harus berstatus "paid" untuk ditandai dikirim' };
    }

    // Jika ada tracking_id, update status di LogistiKita juga
    if (order.tracking_id) {
      const startedAt = Date.now();
      try {
        const url = env.LOGISTIKITA_URL
          ? `${env.LOGISTIKITA_URL}/shipping/${order.tracking_id}`
          : `${env.GATEWAY_BASE_URL}/logistikita/shipping/${order.tracking_id}`;

        await axios.patch(url, { status: 'picked_up' }, {
          headers: { Authorization: `Bearer ${env.GATEWAY_API_KEY || 'mock-key'}` },
          timeout: 5000,
        });
        await writeIntegrationLog({
          service: env.LOGISTIKITA_URL ? 'logistikita' : 'gateway',
          operation: 'shipping.update',
          success: true,
          durationMs: Date.now() - startedAt,
          orderId,
          statusCode: 200,
        });
      } catch (err) {
        await writeIntegrationLog({
          service: env.LOGISTIKITA_URL ? 'logistikita' : 'gateway',
          operation: 'shipping.update',
          success: false,
          durationMs: Date.now() - startedAt,
          orderId,
          statusCode: err.response?.status ?? null,
          errorCode: err.response?.data?.error?.code ?? 'GATEWAY_ERROR',
        });
        // LogistiKita gagal tidak block update status order
        console.error('[Order] LogistiKita update gagal:', err.message);
      }
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }
  if (user.role === 'superadmin') {
    await writeAuditLog({
      actorId: user.id,
      action: 'order.status_changed',
      targetType: 'order',
      targetId: orderId,
      reason,
      before: { status: order.status },
      after: { status },
    });
  }
  return data;
};

/**
 * Ambil status tracking dari LogistiKita
 */
const getTrackingStatus = async (trackingId) => {
  const url = env.LOGISTIKITA_URL
    ? `${env.LOGISTIKITA_URL}/shipping/${trackingId}`
    : `${env.GATEWAY_BASE_URL}/logistikita/shipping/${trackingId}`;

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${env.GATEWAY_API_KEY || 'mock-key'}` },
      timeout: 5000,
    });
    return res.data?.data ?? null;
  } catch {
    return null;
  }
};

module.exports = { getOrders, getOrderById, updateOrderStatus, getTrackingStatus };
