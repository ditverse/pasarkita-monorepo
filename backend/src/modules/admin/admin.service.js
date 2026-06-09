const supabase = require('../../config/supabase');
const { writeAuditLog } = require('../../utils/observability');

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_ROLES = new Set(['buyer', 'seller', 'superadmin']);
const VALID_USER_STATUSES = new Set(['active', 'inactive']);
const USER_SORTS = {
  created_desc: ['created_at', false],
  created_asc: ['created_at', true],
  name_asc: ['name', true],
  name_desc: ['name', false],
};
const PAID_STATUSES = new Set(['paid', 'shipped', 'delivered']);

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const toIso = (date) => date.toISOString();

const startOfJakartaDay = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00+07:00`);
};

const parsePeriod = (query) => {
  const now = new Date();
  let end = query.end ? new Date(query.end) : now;
  let start;

  if (Number.isNaN(end.getTime())) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Tanggal akhir tidak valid' };
  }

  if (query.start) {
    start = new Date(query.start);
  } else {
    const days = query.period === 'today' ? 1 : query.period === '7d' ? 7 : 30;
    start = startOfJakartaDay(new Date(end.getTime() - (days - 1) * DAY_MS));
  }

  if (Number.isNaN(start.getTime()) || start >= end) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Rentang tanggal tidak valid' };
  }

  const duration = end.getTime() - start.getTime();
  if (duration > 366 * DAY_MS) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Rentang analytics maksimal 366 hari' };
  }

  const previousEnd = new Date(start.getTime());
  const previousStart = new Date(start.getTime() - duration);
  const granularity = duration <= 2 * DAY_MS ? 'hour' : 'day';

  return { start, end, previousStart, previousEnd, granularity };
};

const bucketKey = (iso, granularity) => {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(granularity === 'hour' ? { hour: '2-digit', hourCycle: 'h23' } : {}),
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = `${values.year}-${values.month}-${values.day}`;
  return granularity === 'hour' ? `${day} ${values.hour}:00` : day;
};

const percentChange = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

const percentile = (values, pct) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((pct / 100) * sorted.length) - 1);
  return sorted[index];
};

const getUsers = async (query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;
  const [sortColumn, sortAscending] = USER_SORTS[query.sort] || USER_SORTS.created_desc;

  let dbQuery = supabase
    .from('users')
    .select('id, name, email, role, is_active, created_at', { count: 'exact' })
    .order(sortColumn, { ascending: sortAscending })
    .range(offset, offset + limit - 1);

  if (query.role && VALID_ROLES.has(query.role)) dbQuery = dbQuery.eq('role', query.role);
  if (query.status && VALID_USER_STATUSES.has(query.status)) {
    dbQuery = dbQuery.eq('is_active', query.status === 'active');
  }
  if (query.search?.trim()) {
    const escaped = query.search.trim().replace(/[%_,]/g, '');
    if (escaped) dbQuery = dbQuery.or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }
  if (query.created_from) {
    const createdFrom = new Date(`${query.created_from}T00:00:00+07:00`);
    if (Number.isNaN(createdFrom.getTime())) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Tanggal awal tidak valid' };
    }
    dbQuery = dbQuery.gte('created_at', toIso(createdFrom));
  }
  if (query.created_to) {
    const createdTo = new Date(`${query.created_to}T23:59:59.999+07:00`);
    if (Number.isNaN(createdTo.getTime())) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Tanggal akhir tidak valid' };
    }
    dbQuery = dbQuery.lte('created_at', toIso(createdTo));
  }

  const { data, count, error } = await dbQuery;
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  const total = count || 0;
  return {
    data: data || [],
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

const getUserById = async (userId) => {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, name, email, role, is_active, created_at')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw { status: 404, code: 'NOT_FOUND', message: 'User tidak ditemukan' };
  }

  const result = {
    user,
    stats: {
      total_orders: 0,
      paid_orders: 0,
      total_spent: 0,
      total_products: 0,
      active_products: 0,
    },
    recent_orders: [],
    recent_products: [],
    audit_history: { available: true, data: [] },
  };

  const queries = [
    supabase
      .from('admin_audit_logs')
      .select('id, action, reason, before_data, after_data, created_at, actor:users!actor_id(id, name, email)')
      .eq('target_type', 'user')
      .eq('target_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ];

  if (user.role === 'buyer') {
    queries.push(
      supabase
        .from('orders')
        .select('id, status, total, transaction_id, tracking_id, created_at')
        .eq('buyer_id', userId)
        .order('created_at', { ascending: false })
    );
  } else if (user.role === 'seller') {
    queries.push(
      supabase
        .from('products')
        .select('id, name, category, price, stock, is_active, created_at')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
    );
  }

  const [auditResult, roleResult] = await Promise.all(queries);
  if (auditResult.error) {
    result.audit_history = {
      available: false,
      message: 'Audit log belum aktif. Jalankan migration observability.',
      data: [],
    };
  } else {
    result.audit_history.data = auditResult.data || [];
  }

  if (roleResult?.error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: roleResult.error.message };
  }

  if (user.role === 'buyer') {
    const orders = roleResult?.data || [];
    const paidOrders = orders.filter((order) => PAID_STATUSES.has(order.status));
    result.stats.total_orders = orders.length;
    result.stats.paid_orders = paidOrders.length;
    result.stats.total_spent = paidOrders.reduce(
      (sum, order) => sum + Number(order.total || 0),
      0
    );
    result.recent_orders = orders.slice(0, 10);
  }

  if (user.role === 'seller') {
    const products = roleResult?.data || [];
    result.stats.total_products = products.length;
    result.stats.active_products = products.filter((product) => product.is_active).length;
    result.recent_products = products.slice(0, 10);
  }

  return result;
};

const updateUserStatus = async (actor, userId, payload) => {
  const { is_active, reason } = payload;
  if (actor.id === userId) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Admin tidak dapat mengubah status akunnya sendiri' };
  }

  const { data: target, error: findErr } = await supabase
    .from('users')
    .select('id, name, email, role, is_active')
    .eq('id', userId)
    .single();

  if (findErr || !target) throw { status: 404, code: 'NOT_FOUND', message: 'User tidak ditemukan' };
  if (target.role === 'superadmin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Tidak bisa mengubah status superadmin' };
  }

  const { data, error } = await supabase
    .from('users')
    .update({ is_active })
    .eq('id', userId)
    .select('id, is_active')
    .single();

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  await writeAuditLog({
    actorId: actor.id,
    action: is_active ? 'user.activated' : 'user.banned',
    targetType: 'user',
    targetId: userId,
    reason,
    before: { is_active: target.is_active },
    after: { is_active },
  });

  return data;
};

const summarizeOrders = (orders) => {
  const paidOrders = orders.filter((order) => PAID_STATUSES.has(order.status));
  const paymentAttempts = orders.filter((order) => order.status !== 'pending');
  const failedPayments = orders.filter((order) => order.status === 'payment_failed');
  const gmv = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const marketplaceRevenue = paidOrders.reduce(
    (sum, order) => sum + Number(order.fee_marketplace || 0),
    0
  );

  return {
    gmv,
    marketplace_revenue: marketplaceRevenue,
    paid_orders: paidOrders.length,
    total_orders: orders.length,
    average_order_value: paidOrders.length ? Math.round(gmv / paidOrders.length) : 0,
    payment_failure_rate: paymentAttempts.length
      ? Math.round((failedPayments.length / paymentAttempts.length) * 1000) / 10
      : 0,
  };
};

const getIntegrationHealth = async (start, end) => {
  const { data, error } = await supabase
    .from('integration_logs')
    .select('service, operation, success, duration_ms, error_code, created_at')
    .gte('created_at', toIso(start))
    .lte('created_at', toIso(end));

  if (error) {
    return {
      available: false,
      message: 'Jalankan migration observability untuk mengaktifkan health integrasi.',
      services: [],
    };
  }

  const grouped = new Map();
  const addEntry = (service, entry) => {
    const current = grouped.get(service) || { total: 0, success: 0, durations: [], errors: 0 };
    current.total++;
    if (entry.success) current.success++;
    else current.errors++;
    if (Number.isFinite(entry.duration_ms)) current.durations.push(entry.duration_ms);
    grouped.set(service, current);
  };
  (data || []).forEach((entry) => {
    addEntry(entry.service, entry);
    if (entry.service === 'gateway') {
      if (entry.operation.startsWith('payment.')) addEntry('smartbank via gateway', entry);
      if (entry.operation.startsWith('shipping.')) addEntry('logistikita via gateway', entry);
    }
  });

  return {
    available: true,
    services: [...grouped.entries()].map(([service, value]) => ({
      service,
      total_requests: value.total,
      success_rate: value.total ? Math.round((value.success / value.total) * 1000) / 10 : 0,
      errors: value.errors,
      latency_p50_ms: percentile(value.durations, 50),
      latency_p95_ms: percentile(value.durations, 95),
    })),
  };
};

const getAnalytics = async (query) => {
  const period = parsePeriod(query);
  const combinedStart = toIso(period.previousStart);
  const endIso = toIso(period.end);

  const [
    ordersResult,
    usersResult,
    productsResult,
    itemsResult,
    integrationHealth,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, buyer_id, status, total, fee_marketplace, tracking_id, created_at, updated_at')
      .gte('created_at', combinedStart)
      .lte('created_at', endIso),
    supabase
      .from('users')
      .select('id, role, created_at')
      .gte('created_at', combinedStart)
      .lte('created_at', endIso),
    supabase.from('products').select('id, name, category, stock, is_active, seller:users!seller_id(id, name)'),
    supabase
      .from('order_items')
      .select('order_id, product_id, qty, price_at_purchase, product:products(id, name, category, seller:users!seller_id(id, name))'),
    getIntegrationHealth(period.start, period.end),
  ]);

  if (ordersResult.error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: ordersResult.error.message };
  }

  const allOrders = ordersResult.data || [];
  const allUsers = usersResult.data || [];
  const products = productsResult.data || [];
  const orderItems = itemsResult.data || [];
  const inRange = (iso, start, end) => {
    const time = new Date(iso).getTime();
    return time >= start.getTime() && time <= end.getTime();
  };
  const currentOrders = allOrders.filter((order) => inRange(order.created_at, period.start, period.end));
  const previousOrders = allOrders.filter((order) =>
    inRange(order.created_at, period.previousStart, period.previousEnd)
  );
  const currentUsers = allUsers.filter((user) => inRange(user.created_at, period.start, period.end));
  const previousUsers = allUsers.filter((user) =>
    inRange(user.created_at, period.previousStart, period.previousEnd)
  );
  const currentSummary = summarizeOrders(currentOrders);
  const previousSummary = summarizeOrders(previousOrders);
  const activeBuyerIds = new Set(currentOrders.map((order) => order.buyer_id).filter(Boolean));
  const activeSellerIds = new Set();
  const currentOrderIds = new Set(currentOrders.map((order) => order.id));
  const paidOrderIds = new Set(
    currentOrders.filter((order) => PAID_STATUSES.has(order.status)).map((order) => order.id)
  );

  orderItems.forEach((item) => {
    if (currentOrderIds.has(item.order_id) && item.product?.seller) {
      activeSellerIds.add(item.product.seller.id);
    }
  });

  const summary = {
    ...currentSummary,
    active_buyers: activeBuyerIds.size,
    active_sellers: activeSellerIds.size,
    new_users: currentUsers.length,
    total_products: products.length,
    low_stock_products: products.filter((product) => product.is_active && product.stock <= 5).length,
  };

  const comparison = {
    gmv: percentChange(summary.gmv, previousSummary.gmv),
    marketplace_revenue: percentChange(
      summary.marketplace_revenue,
      previousSummary.marketplace_revenue
    ),
    paid_orders: percentChange(summary.paid_orders, previousSummary.paid_orders),
    new_users: percentChange(currentUsers.length, previousUsers.length),
  };

  const statusCounts = {};
  currentOrders.forEach((order) => {
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
  });
  const ordersByStatus = Object.entries(statusCounts).map(([key, count]) => ({
    key,
    count,
    pct: currentOrders.length ? Math.round((count / currentOrders.length) * 1000) / 10 : 0,
  }));

  const timeBuckets = new Map();
  currentOrders.forEach((order) => {
    const key = bucketKey(order.created_at, period.granularity);
    const value = timeBuckets.get(key) || {
      bucket: key,
      gmv: 0,
      marketplace_revenue: 0,
      orders: 0,
      payment_success: 0,
      payment_failed: 0,
      shipping_created: 0,
      shipped: 0,
      delivered: 0,
      new_buyers: 0,
      new_sellers: 0,
    };
    value.orders++;
    if (PAID_STATUSES.has(order.status)) {
      value.gmv += Number(order.total || 0);
      value.marketplace_revenue += Number(order.fee_marketplace || 0);
      value.payment_success++;
    }
    if (order.status === 'payment_failed') value.payment_failed++;
    if (order.tracking_id) value.shipping_created++;
    if (['shipped', 'delivered'].includes(order.status)) value.shipped++;
    if (order.status === 'delivered') value.delivered++;
    timeBuckets.set(key, value);
  });
  currentUsers.forEach((user) => {
    const key = bucketKey(user.created_at, period.granularity);
    const value = timeBuckets.get(key) || {
      bucket: key,
      gmv: 0,
      marketplace_revenue: 0,
      orders: 0,
      payment_success: 0,
      payment_failed: 0,
      shipping_created: 0,
      shipped: 0,
      delivered: 0,
      new_buyers: 0,
      new_sellers: 0,
    };
    if (user.role === 'buyer') value.new_buyers++;
    if (user.role === 'seller') value.new_sellers++;
    timeBuckets.set(key, value);
  });

  const topProductMap = new Map();
  const categoryMap = new Map();
  const pulseMap = new Map();
  const orderById = new Map(currentOrders.map((order) => [order.id, order]));
  orderItems.forEach((item) => {
    if (!paidOrderIds.has(item.order_id)) return;
    const product = item.product || {};
    const productId = item.product_id;
    const existing = topProductMap.get(productId) || {
      product_id: productId,
      name: product.name || 'Produk dihapus',
      seller: product.seller?.name || '-',
      sold: 0,
      gmv: 0,
    };
    existing.sold += Number(item.qty || 0);
    existing.gmv += Number(item.qty || 0) * Number(item.price_at_purchase || 0);
    topProductMap.set(productId, existing);

    const category = product.category || 'Lainnya';
    const categoryValue = categoryMap.get(category) || { category, sold: 0, gmv: 0 };
    categoryValue.sold += Number(item.qty || 0);
    categoryValue.gmv += Number(item.qty || 0) * Number(item.price_at_purchase || 0);
    categoryMap.set(category, categoryValue);

    const order = orderById.get(item.order_id);
    if (order) {
      const pulseKey = `${category}::${bucketKey(order.created_at, period.granularity)}`;
      pulseMap.set(pulseKey, (pulseMap.get(pulseKey) || 0) + Number(item.qty || 0));
    }
  });

  const paid = currentOrders.filter((order) => PAID_STATUSES.has(order.status)).length;
  const shippingCreated = currentOrders.filter((order) => order.tracking_id).length;
  const funnel = [
    { key: 'checkout_created', label: 'Checkout dibuat', count: currentOrders.length },
    {
      key: 'payment_requested',
      label: 'Payment diproses',
      count: currentOrders.filter((order) => order.status !== 'pending').length,
    },
    { key: 'paid', label: 'Pembayaran sukses', count: paid },
    { key: 'shipping_created', label: 'Pengiriman dibuat', count: shippingCreated },
    {
      key: 'shipped',
      label: 'Dikirim',
      count: currentOrders.filter((order) => ['shipped', 'delivered'].includes(order.status)).length,
    },
    {
      key: 'delivered',
      label: 'Selesai',
      count: currentOrders.filter((order) => order.status === 'delivered').length,
    },
  ];

  const now = Date.now();
  const paidWithoutTracking = currentOrders.filter(
    (order) => PAID_STATUSES.has(order.status) && !order.tracking_id
  );
  const stalePending = currentOrders.filter(
    (order) => order.status === 'pending' && now - new Date(order.created_at).getTime() > DAY_MS
  );
  const paymentFailed = currentOrders.filter((order) => order.status === 'payment_failed');
  const lowStock = products.filter((product) => product.is_active && product.stock <= 5);
  const delayedPaidOrders = currentOrders.filter(
    (order) =>
      order.status === 'paid' &&
      !order.tracking_id &&
      now - new Date(order.updated_at || order.created_at).getTime() > DAY_MS
  );
  const gatewayHealth = integrationHealth.services.find((service) => service.service === 'gateway');
  const integrationErrors = gatewayHealth
    ? gatewayHealth.errors
    : integrationHealth.services.reduce((sum, service) => sum + service.errors, 0);
  const actionCenter = [
    {
      key: 'paid_without_tracking',
      severity: paidWithoutTracking.length ? 'high' : 'ok',
      title: 'Order dibayar tanpa tracking',
      count: paidWithoutTracking.length,
      href: '/admin/orders?status=paid',
      owner: 'Seller Operations',
      description: 'Pastikan seller membuat pengiriman untuk order yang sudah dibayar.',
    },
    {
      key: 'payment_failed',
      severity: paymentFailed.length ? 'medium' : 'ok',
      title: 'Pembayaran gagal',
      count: paymentFailed.length,
      href: '/admin/orders?status=payment_failed',
      owner: 'Finance Operations',
      description: 'Tinjau pola kegagalan sebelum meminta pembeli mencoba kembali.',
    },
    {
      key: 'stale_pending',
      severity: stalePending.length ? 'medium' : 'ok',
      title: 'Pending lebih dari 24 jam',
      count: stalePending.length,
      href: '/admin/orders?status=pending',
      owner: 'Order Operations',
      description: 'Periksa order lama yang belum masuk ke tahap pembayaran.',
    },
    {
      key: 'seller_delay',
      severity: delayedPaidOrders.length ? 'high' : 'ok',
      title: 'Seller terlambat memproses order',
      count: delayedPaidOrders.length,
      href: '/admin/orders?status=paid',
      owner: 'Seller Operations',
      description: 'Order paid belum memiliki tracking setelah lebih dari 24 jam.',
    },
    {
      key: 'low_stock',
      severity: lowStock.length ? 'low' : 'ok',
      title: 'Produk stok kritis',
      count: lowStock.length,
      href: '/admin/analytics',
      owner: 'Catalog Operations',
      description: 'Hubungi seller untuk mengisi stok produk aktif yang tersisa lima atau kurang.',
    },
    {
      key: 'integration_errors',
      severity: !integrationHealth.available ? 'low' : integrationErrors ? 'high' : 'ok',
      title: integrationHealth.available ? 'Error integrasi eksternal' : 'Monitoring integrasi belum aktif',
      count: integrationHealth.available ? integrationErrors : 1,
      href: '/admin/analytics',
      owner: 'Platform Operations',
      description: integrationHealth.available
        ? 'Periksa error SmartBank, Gateway, atau LogistiKita pada periode terpilih.'
        : 'Jalankan migration observability agar kesehatan integrasi dapat dipantau.',
    },
  ];

  return {
    period: {
      start: toIso(period.start),
      end: endIso,
      timezone: 'Asia/Jakarta',
      granularity: period.granularity,
      generated_at: new Date().toISOString(),
    },
    summary,
    comparison,
    timeseries: [...timeBuckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
    transaction_funnel: funnel,
    orders_by_status: ordersByStatus,
    top_products: [...topProductMap.values()]
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5)
      .map((product, index) => ({ rank: index + 1, ...product })),
    top_categories: [...categoryMap.values()].sort((a, b) => b.gmv - a.gmv).slice(0, 5),
    marketplace_pulse: [...pulseMap.entries()].map(([key, value]) => {
      const [category, bucket] = key.split('::');
      return { category, bucket, value };
    }),
    integration_health: integrationHealth,
    action_center: actionCenter,
  };
};

const getAuditLogs = async (query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;
  let dbQuery = supabase
    .from('admin_audit_logs')
    .select('*, actor:users!actor_id(id, name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query.action) dbQuery = dbQuery.eq('action', query.action);
  if (query.target_type) dbQuery = dbQuery.eq('target_type', query.target_type);
  if (query.target_id) dbQuery = dbQuery.eq('target_id', query.target_id);

  const { data, count, error } = await dbQuery;
  if (error) {
    if (error.code === '42P01') {
      throw {
        status: 503,
        code: 'OBSERVABILITY_NOT_READY',
        message: 'Jalankan migration observability terlebih dahulu',
      };
    }
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  const total = count || 0;
  return {
    data: data || [],
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

module.exports = { getUsers, getUserById, updateUserStatus, getAnalytics, getAuditLogs };
