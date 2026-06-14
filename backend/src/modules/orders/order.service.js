const supabase = require('../../config/supabase');
const { triggerShipping } = require('../../integrations/logistikita');
const axios = require('axios');
const env = require('../../config/env');
const { writeAuditLog, writeIntegrationLog } = require('../../utils/observability');
const { getIntegrationTarget } = require('../../integrations/target');

const ORDER_STATUSES = new Set(['pending', 'paid', 'processing', 'shipped', 'delivered', 'payment_failed']);
const ORDER_SORTS = {
  created_desc: ['created_at', false],
  created_asc: ['created_at', true],
  total_desc: ['total', false],
  total_asc: ['total', true],
  status_asc: ['status', true],
  status_desc: ['status', false],
  updated_desc: ['updated_at', false],
  updated_asc: ['updated_at', true],
  action_deadline: ['created_at', true],
};
let snapshotsAvailable;

const hasOrderItemSnapshots = async () => {
  if (snapshotsAvailable !== undefined) return snapshotsAvailable;
  const { error } = await supabase
    .from('order_items')
    .select('product_name_at_purchase')
    .limit(1);
  snapshotsAvailable = !error;
  return snapshotsAvailable;
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

const getSellerOrderScope = async (sellerId, search = '') => {
  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, product_name_at_purchase, product:products!inner(id, name, seller_id)')
    .eq('product.seller_id', sellerId);

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  const scopedItems = data || [];
  const allOrderIds = [...new Set(scopedItems.map((item) => item.order_id))];
  const term = search.trim().toLowerCase();
  if (!term || allOrderIds.length === 0) return allOrderIds;

  const { data: scopedOrders, error: ordersError } = await supabase
    .from('orders')
    .select('id, transaction_id, tracking_id')
    .in('id', allOrderIds);

  if (ordersError) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: ordersError.message };
  }

  const matchingIds = new Set(
    scopedItems
      .filter((item) =>
        item.product_name_at_purchase?.toLowerCase().includes(term) ||
        item.product?.name?.toLowerCase().includes(term)
      )
      .map((item) => item.order_id)
  );

  for (const order of scopedOrders || []) {
    if (
      order.id.toLowerCase().startsWith(term) ||
      order.transaction_id?.toLowerCase().includes(term) ||
      order.tracking_id?.toLowerCase().includes(term)
    ) {
      matchingIds.add(order.id);
    }
  }

  return [...matchingIds];
};

const getSellerActionReason = (status, containsOtherSellerItems) => {
  if (containsOtherSellerItems) {
    return 'Order multi-toko belum dapat dikirim sekaligus sampai fulfillment per seller tersedia.';
  }
  if (status === 'pending') return 'Menunggu pembayaran dikonfirmasi.';
  if (status === 'payment_failed') return 'Pembayaran gagal, pesanan tidak perlu dikirim.';
  if (status === 'paid') return null;
  if (status === 'processing') return null;
  if (status === 'shipped') return 'Pesanan sudah ditandai sedang dikirim.';
  if (status === 'delivered') return 'Pesanan sudah diterima pembeli.';
  return null;
};

const projectOrderForSeller = (order, sellerId) => {
  const sellerItems = (order.items || []).filter((item) => item.product?.seller_id === sellerId);
  const sellerSubtotal = sellerItems.reduce(
    (sum, item) => sum + item.price_at_purchase * item.qty,
    0
  );
  const sellerFee = order.subtotal > 0
    ? Math.round(order.fee_marketplace * (sellerSubtotal / order.subtotal))
    : 0;
  const containsOtherSellerItems = sellerItems.length !== (order.items || []).length;

  return {
    ...order,
    subtotal: sellerSubtotal,
    fee_marketplace: sellerFee,
    total: sellerSubtotal + sellerFee,
    buyer: order.buyer ? { id: order.buyer.id, name: order.buyer.name } : null,
    items: sellerItems,
    seller_item_scope: true,
    seller_can_process: order.status === 'paid' && !containsOtherSellerItems,
    seller_can_ship: order.status === 'processing' && !containsOtherSellerItems,
    seller_action_reason: getSellerActionReason(order.status, containsOtherSellerItems),
  };
};

const getOrders = async (user, query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;
  const [sortColumn, sortAscending] = ORDER_SORTS[query.sort] || ORDER_SORTS.created_desc;

  const itemSelect = await hasOrderItemSnapshots()
    ? 'product_id, qty, price_at_purchase, product_name_at_purchase, product:products(id, name, seller_id, seller:users!seller_id(id, name))'
    : 'product_id, qty, price_at_purchase, product:products(id, name, seller_id, seller:users!seller_id(id, name))';

  let supaQuery = supabase
    .from('orders')
    .select(
      `*, buyer:users!buyer_id(id, name, email), items:order_items(${itemSelect})`,
      { count: 'exact' }
    )
    .order(sortColumn, { ascending: sortAscending })
    .range(offset, offset + limit - 1);

  if (user.role === 'buyer') {
    supaQuery = supaQuery.eq('buyer_id', user.id);
  }
  if (user.role === 'seller') {
    const sellerOrderIds = await getSellerOrderScope(user.id, query.search);
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
  if ((user.role === 'superadmin' || user.role === 'seller') && query.created_from) {
    const createdFrom = new Date(`${query.created_from}T00:00:00+07:00`);
    if (Number.isNaN(createdFrom.getTime())) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Tanggal awal tidak valid' };
    }
    supaQuery = supaQuery.gte('created_at', createdFrom.toISOString());
  }
  if ((user.role === 'superadmin' || user.role === 'seller') && query.created_to) {
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
  const orders = (data || []).map((rawOrder) => {
    const order = user.role === 'seller'
      ? projectOrderForSeller(rawOrder, user.id)
      : rawOrder;

    return {
      ...order,
      items: (order.items || []).map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name_at_purchase ?? item.product?.name ?? 'Produk dihapus',
        seller: item.product?.seller ?? null,
        qty: item.qty,
        price_at_purchase: item.price_at_purchase,
      })),
    };
  });

  return {
    data: orders,
    pagination: { page, limit, total: count || 0, total_pages: totalPages },
  };
};

const getOrderById = async (user, orderId) => {
  const itemSelect = await hasOrderItemSnapshots()
    ? 'product_id, qty, price_at_purchase, product_name_at_purchase, product:products(id, name, category, seller_id, seller:users!seller_id(id, name, email))'
    : 'product_id, qty, price_at_purchase, product:products(id, name, category, seller_id, seller:users!seller_id(id, name, email))';
  const { data, error } = await supabase
    .from('orders')
    .select(`*, items:order_items(${itemSelect}), buyer:users!buyer_id(id, name, email)`)
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

  const visibleOrder = user.role === 'seller'
    ? projectOrderForSeller(data, user.id)
    : data;
  const reshapedItems = (visibleOrder.items || []).map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name_at_purchase ?? item.product?.name ?? 'Produk dihapus',
    category: item.product?.category ?? null,
    seller: item.product?.seller ?? null,
    qty: item.qty,
    price_at_purchase: item.price_at_purchase,
  }));

  const { data: statusHistory, error: historyError } = await supabase
    .from('order_status_history')
    .select('id, status, source, note, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (historyError) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: historyError.message };
  }

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
    ...visibleOrder,
    items: reshapedItems,
    status_history: statusHistory || [],
    audit_history: auditHistory,
    integration_timeline: integrationTimeline,
  };
};

const updateOrderStatus = async (user, orderId, status, reason = null) => {
  // Validasi status yang diizinkan per role
  const sellerAllowed = [];
  const buyerAllowed = ['delivered'];
  const adminAllowed = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'payment_failed'];

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
        ? 'Gunakan workflow proses dan kirim untuk mengubah status pesanan seller'
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

const getSellerFulfillmentOrder = async (sellerId, orderId, options = {}) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, buyer:users!buyer_id(id, name), items:order_items(product_id, qty, price_at_purchase, product_name_at_purchase, product:products(id, name, seller_id))')
    .eq('id', orderId)
    .single();
  if (error || !data) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Order tidak ditemukan' };
  }
  const sellerIds = new Set((data.items || []).map((item) => item.product?.seller_id).filter(Boolean));
  if (!sellerIds.has(sellerId)) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Akses ditolak' };
  }
  if (sellerIds.size > 1 && !options.allowMultiSeller) {
    throw {
      status: 409,
      code: 'MULTI_SELLER_FULFILLMENT_REQUIRED',
      message: 'Order multi-toko memerlukan fulfillment per seller dan belum dapat diproses.',
    };
  }
  return data;
};

const saveShippingSync = async (orderId, status, errorMessage = null, trackingId = undefined) => {
  const changes = {
    shipping_sync_status: status,
    shipping_sync_error: errorMessage,
    shipping_sync_updated_at: new Date().toISOString(),
  };
  if (trackingId !== undefined) changes.tracking_id = trackingId;
  await supabase.from('orders').update(changes).eq('id', orderId);
};

const syncShipping = async (order) => {
  await saveShippingSync(order.id, 'pending');
  try {
    let trackingId = order.tracking_id;
    if (!trackingId) {
      const result = await triggerShipping({
        orderId: order.id,
        fromAddress: order.pickup_address_snapshot,
        toAddress: order.shipping_address,
        itemsCount: (order.items || []).reduce((sum, item) => sum + item.qty, 0),
      });
      trackingId = result.data?.tracking_id ?? null;
      if (!trackingId) {
        throw { status: 502, code: 'TRACKING_ID_MISSING', message: 'LogistiKita tidak mengembalikan tracking ID' };
      }
    } else {
      const target = getIntegrationTarget('logistikita', `/shipping/${trackingId}`);
      const startedAt = Date.now();
      try {
        const response = await axios.patch(target.url, { status: 'picked_up' }, {
          headers: { Authorization: `Bearer ${env.GATEWAY_API_KEY || 'mock-key'}` },
          timeout: 5000,
        });
        await writeIntegrationLog({
          service: target.logService,
          operation: 'shipping.update',
          success: true,
          durationMs: Date.now() - startedAt,
          orderId: order.id,
          statusCode: response.status,
        });
      } catch (error) {
        await writeIntegrationLog({
          service: target.logService,
          operation: 'shipping.update',
          success: false,
          durationMs: Date.now() - startedAt,
          orderId: order.id,
          statusCode: error.response?.status ?? null,
          errorCode: error.response?.data?.error?.code ?? 'GATEWAY_ERROR',
        });
        throw error;
      }
    }
    await saveShippingSync(order.id, 'synced', null, trackingId);
    return trackingId;
  } catch (error) {
    const message = error.message || 'Sinkronisasi LogistiKita gagal';
    await saveShippingSync(order.id, 'failed', message);
    throw {
      status: error.status || error.response?.status || 502,
      code: error.code || error.response?.data?.error?.code || 'LOGISTICS_SYNC_FAILED',
      message,
    };
  }
};

const startProcessing = async (user, orderId, pickupAddress) => {
  const order = await getSellerFulfillmentOrder(user.id, orderId);
  if (order.status !== 'paid') {
    throw { status: 400, code: 'INVALID_STATUS', message: 'Hanya pesanan berstatus paid yang dapat mulai diproses' };
  }
  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'processing',
      pickup_address_snapshot: pickupAddress.trim(),
    })
    .eq('id', orderId)
    .eq('status', 'paid')
    .select()
    .single();
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const retryShipping = async (user, orderId) => {
  const order = await getSellerFulfillmentOrder(user.id, orderId);
  if (order.status !== 'processing') {
    throw { status: 400, code: 'INVALID_STATUS', message: 'Sinkronisasi hanya dapat dilakukan saat pesanan diproses' };
  }
  if (!order.pickup_address_snapshot) {
    throw { status: 400, code: 'PICKUP_REQUIRED', message: 'Alamat pickup belum dikonfirmasi' };
  }
  const trackingId = await syncShipping(order);
  return { tracking_id: trackingId, shipping_sync_status: 'synced' };
};

const shipOrder = async (user, orderId) => {
  const order = await getSellerFulfillmentOrder(user.id, orderId);
  if (order.status !== 'processing') {
    throw { status: 400, code: 'INVALID_STATUS', message: 'Pesanan harus berstatus processing sebelum dikirim' };
  }
  await syncShipping(order);
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'shipped' })
    .eq('id', orderId)
    .eq('status', 'processing')
    .select()
    .single();
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const getPackingList = async (user, orderId) => {
  const order = await getSellerFulfillmentOrder(user.id, orderId, { allowMultiSeller: true });
  const { data: profile } = await supabase
    .from('seller_profiles')
    .select('store_name, contact_phone, pickup_address')
    .eq('seller_id', user.id)
    .maybeSingle();
  return {
    order_id: order.id,
    created_at: order.created_at,
    buyer_name: order.buyer?.name || 'Pembeli',
    shipping_address: order.shipping_address,
    tracking_id: order.tracking_id,
    pickup_address: order.pickup_address_snapshot || profile?.pickup_address || null,
    store_name: profile?.store_name || user.name || 'Toko',
    contact_phone: profile?.contact_phone || null,
    items: (order.items || [])
      .filter((item) => item.product?.seller_id === user.id)
      .map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name_at_purchase || item.product?.name || 'Produk',
      qty: item.qty,
      })),
  };
};

/**
 * Ambil status tracking dari LogistiKita
 */
const getTrackingStatus = async (trackingId) => {
  try {
    const target = getIntegrationTarget('logistikita', `/shipping/${trackingId}`);
    const res = await axios.get(target.url, {
      headers: { Authorization: `Bearer ${env.GATEWAY_API_KEY || 'mock-key'}` },
      timeout: 5000,
    });
    return res.data?.data ?? null;
  } catch {
    return null;
  }
};


const exportOrdersBySeller = async (sellerId, query) => {
  // Dapatkan scope order seller
  const sellerOrderIds = await getSellerOrderScope(sellerId, query.search || '');
  if (sellerOrderIds.length === 0) {
    return { csv: 'ID,Status,Subtotal,Fee,Total,Pembeli,Alamat Pengiriman,Resi,Dibuat\r\n', count: 0, truncated: false };
  }

  let dbQuery = supabase
    .from('orders')
    .select('id, status, subtotal, fee_marketplace, total, shipping_address, transaction_id, tracking_id, created_at, buyer:users!buyer_id(id, name)')
    .in('id', sellerOrderIds)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (query.status && ORDER_STATUSES.has(query.status)) {
    dbQuery = dbQuery.eq('status', query.status);
  }
  if (query.created_from) {
    const from = new Date(`${query.created_from}T00:00:00+07:00`);
    if (!Number.isNaN(from.getTime())) dbQuery = dbQuery.gte('created_at', from.toISOString());
  }
  if (query.created_to) {
    const to = new Date(`${query.created_to}T23:59:59.999+07:00`);
    if (!Number.isNaN(to.getTime())) dbQuery = dbQuery.lte('created_at', to.toISOString());
  }

  const { data, error } = await dbQuery;
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  const rows = data || [];
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const STATUS_LABEL = {
    pending: 'Menunggu Pembayaran',
    paid: 'Perlu Diproses',
    processing: 'Sedang Dikemas',
    shipped: 'Sedang Dikirim',
    delivered: 'Selesai',
    payment_failed: 'Pembayaran Gagal',
  };
  const headers = ['Order ID', 'Status', 'Subtotal', 'Fee Marketplace', 'Total', 'Nama Pembeli', 'Alamat Pengiriman', 'Transaction ID', 'Nomor Resi', 'Tanggal Order'];
  const lines = [
    headers.join(','),
    ...rows.map((row) => [
      row.id,
      escapeCSV(STATUS_LABEL[row.status] ?? row.status),
      row.subtotal,
      row.fee_marketplace,
      row.total,
      escapeCSV(row.buyer?.name),
      escapeCSV(row.shipping_address),
      escapeCSV(row.transaction_id),
      escapeCSV(row.tracking_id),
      row.created_at ? new Date(row.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '',
    ].join(',')),
  ];

  return {
    csv: lines.join('\r\n'),
    count: rows.length,
    truncated: rows.length >= 5000,
  };
};

const cancelOrder = async (orderId, buyerId) => {
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, status, stock_reserved')
    .eq('id', orderId)
    .eq('buyer_id', buyerId)
    .single();

  if (orderErr) throw { status: 404, code: 'NOT_FOUND', message: 'Order tidak ditemukan' };
  if (order.status !== 'pending') throw { status: 400, code: 'INVALID_STATUS', message: 'Hanya pesanan pending yang dapat dibatalkan' };

  // Update status to cancelled
  const { data: updated, error: updateErr } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .select()
    .single();

  if (updateErr) throw { status: 500, code: 'INTERNAL_ERROR', message: updateErr.message };

  // Call rpc to release stock if reserved
  if (order.stock_reserved) {
    const { error: rpcErr } = await supabase.rpc('release_checkout_stock', { p_order_id: orderId });
    if (rpcErr) {
      console.error('[cancelOrder] Gagal restore stok:', rpcErr);
    }
  }

  return updated;
};

module.exports = {
  getOrders,
  getOrderById,
  updateOrderStatus,
  getTrackingStatus,
  startProcessing,
  shipOrder,
  retryShipping,
  getPackingList,
  exportOrdersBySeller,
  cancelOrder,
};
