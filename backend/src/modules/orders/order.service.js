const supabase = require('../../config/supabase');
const { triggerShipping } = require('../../integrations/logistikita');
const axios = require('axios');
const env = require('../../config/env');
const { writeAuditLog, writeIntegrationLog } = require('../../utils/observability');

const ORDER_STATUSES = new Set(['pending', 'paid', 'shipped', 'delivered', 'payment_failed']);
const ORDER_SORTS = {
  created_desc: ['created_at', false],
  created_asc: ['created_at', true],
  total_desc: ['total', false],
  total_asc: ['total', true],
  status_asc: ['status', true],
  status_desc: ['status', false],
  updated_desc: ['updated_at', false],
  updated_asc: ['updated_at', true],
};

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const findAdminOrderIds = async (search) => {
  const term = search.trim();
  if (!term) return null;
  const safeTerm = term.replace(/[%_,]/g, '');

  const [ordersResult, buyersResult] = await Promise.all([
    supabase.from('orders').select('id, transaction_id, tracking_id'),
    safeTerm
      ? supabase
        .from('users')
        .select('id')
        .eq('role', 'buyer')
        .or(`name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%`)
        .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ordersResult.error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: ordersResult.error.message };
  }
  if (buyersResult.error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: buyersResult.error.message };
  }

  const normalized = term.toLowerCase();
  const buyerIds = new Set((buyersResult.data || []).map((buyer) => buyer.id));
  const matchingOrderIds = (ordersResult.data || [])
    .filter((order) =>
      order.id.toLowerCase().startsWith(normalized) ||
      order.transaction_id?.toLowerCase().includes(normalized) ||
      order.tracking_id?.toLowerCase().includes(normalized)
    )
    .map((order) => order.id);

  if (buyerIds.size > 0) {
    const buyerOrders = await supabase
      .from('orders')
      .select('id')
      .in('buyer_id', [...buyerIds]);
    if (buyerOrders.error) {
      throw { status: 500, code: 'INTERNAL_ERROR', message: buyerOrders.error.message };
    }
    matchingOrderIds.push(...(buyerOrders.data || []).map((order) => order.id));
  }

  return [...new Set(matchingOrderIds)];
};

const getSellerOrderIds = async (sellerId) => {
  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, product:products!inner(seller_id)')
    .eq('product.seller_id', sellerId);

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return [...new Set((data || []).map((item) => item.order_id))];
};

const getOrders = async (user, query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;
  const [sortColumn, sortAscending] = ORDER_SORTS[query.sort] || ORDER_SORTS.created_desc;

  let supaQuery = supabase
    .from('orders')
    .select(
      '*, buyer:users!buyer_id(id, name, email), items:order_items(product_id, qty, price_at_purchase, product:products(id, name, seller_id, seller:users!seller_id(id, name)))',
      { count: 'exact' }
    )
    .order(sortColumn, { ascending: sortAscending })
    .range(offset, offset + limit - 1);

  if (user.role === 'buyer') {
    supaQuery = supaQuery.eq('buyer_id', user.id);
  }
  if (user.role === 'seller') {
    const sellerOrderIds = await getSellerOrderIds(user.id);
    if (sellerOrderIds.length === 0) {
      return { data: [], pagination: { page, limit, total: 0, total_pages: 0 } };
    }
    supaQuery = supaQuery.in('id', sellerOrderIds);
  }

  if (query.status && ORDER_STATUSES.has(query.status)) {
    supaQuery = supaQuery.eq('status', query.status);
  }
  if (user.role === 'superadmin' && query.search?.trim()) {
    const matchingIds = await findAdminOrderIds(query.search);
    if (matchingIds.length === 0) {
      return { data: [], pagination: { page, limit, total: 0, total_pages: 0 } };
    }
    supaQuery = supaQuery.in('id', matchingIds);
  }
  if (user.role === 'superadmin' && query.created_from) {
    const createdFrom = new Date(`${query.created_from}T00:00:00+07:00`);
    if (Number.isNaN(createdFrom.getTime())) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Tanggal awal tidak valid' };
    }
    supaQuery = supaQuery.gte('created_at', createdFrom.toISOString());
  }
  if (user.role === 'superadmin' && query.created_to) {
    const createdTo = new Date(`${query.created_to}T23:59:59.999+07:00`);
    if (Number.isNaN(createdTo.getTime())) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Tanggal akhir tidak valid' };
    }
    supaQuery = supaQuery.lte('created_at', createdTo.toISOString());
  }

  const { data, error, count } = await supaQuery;

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  const totalPages = Math.ceil((count || 0) / limit);

  return {
    data: data || [],
    pagination: { page, limit, total: count || 0, total_pages: totalPages },
  };
};

const getOrderById = async (user, orderId) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(product_id, qty, price_at_purchase, product:products(id, name, category, seller_id, seller:users!seller_id(id, name, email))), buyer:users!buyer_id(id, name, email)')
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
    category: item.product?.category ?? null,
    seller: item.product?.seller ?? null,
    qty: item.qty,
    price_at_purchase: item.price_at_purchase,
  }));

  let auditHistory = { available: true, data: [] };
  let integrationTimeline = { available: true, data: [] };
  if (user.role === 'superadmin') {
    const [auditResult, integrationResult] = await Promise.all([
      supabase
        .from('admin_audit_logs')
        .select('id, action, reason, before_data, after_data, created_at, actor:users!actor_id(id, name, email)')
        .eq('target_type', 'order')
        .eq('target_id', orderId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('integration_logs')
        .select('id, service, operation, success, duration_ms, status_code, error_code, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }),
    ]);

    auditHistory = auditResult.error
      ? { available: false, message: 'Audit log belum aktif.', data: [] }
      : { available: true, data: auditResult.data || [] };
    integrationTimeline = integrationResult.error
      ? { available: false, message: 'Integration log belum aktif.', data: [] }
      : { available: true, data: integrationResult.data || [] };
  }

  return {
    ...data,
    items: reshapedItems,
    audit_history: auditHistory,
    integration_timeline: integrationTimeline,
  };
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
