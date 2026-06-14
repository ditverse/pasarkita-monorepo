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
const PAID_STATUSES = new Set(['paid', 'processing', 'shipped', 'delivered']);
const REPORT_TYPES = new Set(['orders', 'users', 'sellers', 'products', 'analytics']);

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

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

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

const getModerationSellers = async (query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;
  let dbQuery = supabase
    .from('users')
    .select('id, name, email, is_active, created_at', { count: 'exact' })
    .eq('role', 'seller')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query.status && VALID_USER_STATUSES.has(query.status)) {
    dbQuery = dbQuery.eq('is_active', query.status === 'active');
  }
  if (query.search?.trim()) {
    const escaped = query.search.trim().replace(/[%_,]/g, '');
    if (escaped) dbQuery = dbQuery.or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  const { data: sellers, count, error } = await dbQuery;
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  const sellerIds = (sellers || []).map((seller) => seller.id);
  let products = [];
  if (sellerIds.length > 0) {
    const productsResult = await supabase
      .from('products')
      .select('seller_id, is_active, stock')
      .in('seller_id', sellerIds);
    if (productsResult.error) {
      throw { status: 500, code: 'INTERNAL_ERROR', message: productsResult.error.message };
    }
    products = productsResult.data || [];
  }

  const summaryBySeller = new Map();
  products.forEach((product) => {
    const current = summaryBySeller.get(product.seller_id) || {
      total_products: 0,
      active_products: 0,
      inactive_products: 0,
      low_stock_products: 0,
    };
    current.total_products++;
    if (product.is_active) current.active_products++;
    else current.inactive_products++;
    if (product.is_active && product.stock <= 5) current.low_stock_products++;
    summaryBySeller.set(product.seller_id, current);
  });

  const total = count || 0;
  return {
    data: (sellers || []).map((seller) => ({
      ...seller,
      verification_status: 'not_configured',
      product_summary: summaryBySeller.get(seller.id) || {
        total_products: 0,
        active_products: 0,
        inactive_products: 0,
        low_stock_products: 0,
      },
    })),
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

const getModerationProducts = async (query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;
  let dbQuery = supabase
    .from('products')
    .select(
      'id, seller_id, name, description, category, price, stock, is_active, created_at, seller:users!seller_id(id, name, email, is_active)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (query.status === 'active') dbQuery = dbQuery.eq('is_active', true);
  if (query.status === 'inactive') dbQuery = dbQuery.eq('is_active', false);
  if (query.category) dbQuery = dbQuery.eq('category', query.category);
  if (query.seller_id) dbQuery = dbQuery.eq('seller_id', query.seller_id);
  if (query.stock === 'low') dbQuery = dbQuery.lte('stock', 5);
  if (query.stock === 'empty') dbQuery = dbQuery.eq('stock', 0);
  if (query.search?.trim()) {
    const escaped = query.search.trim().replace(/[%_,]/g, '');
    if (escaped) dbQuery = dbQuery.ilike('name', `%${escaped}%`);
  }

  const { data, count, error } = await dbQuery;
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  const total = count || 0;
  return {
    data: data || [],
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

const getModerationProductById = async (productId) => {
  const { data: product, error: productError } = await supabase
    .from('products')
    .select(
      'id, seller_id, name, description, category, price, stock, is_active, created_at, seller:users!seller_id(id, name, email, is_active)'
    )
    .eq('id', productId)
    .single();

  if (productError || !product) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  }

  const [itemsResult, ratingsResult, auditResult] = await Promise.all([
    supabase
      .from('order_items')
      .select('qty, price_at_purchase, order:orders!order_id(id, status, total, created_at, buyer:users!buyer_id(id, name, email))')
      .eq('product_id', productId),
    supabase
      .from('ratings')
      .select('id, rating, comment, created_at, buyer:users!buyer_id(id, name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('admin_audit_logs')
      .select('id, action, reason, before_data, after_data, created_at, actor:users!actor_id(id, name, email)')
      .eq('target_type', 'product')
      .eq('target_id', productId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (itemsResult.error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: itemsResult.error.message };
  }

  const paidItems = (itemsResult.data || [])
    .filter((item) => item.order && PAID_STATUSES.has(item.order.status))
    .sort((a, b) => new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime());
  const ratings = ratingsResult.error ? [] : (ratingsResult.data || []);
  const soldUnits = paidItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const productGmv = paidItems.reduce(
    (sum, item) => sum + Number(item.qty || 0) * Number(item.price_at_purchase || 0),
    0
  );
  const averageRating = ratings.length
    ? Math.round(
      (ratings.reduce((sum, rating) => sum + Number(rating.rating || 0), 0) / ratings.length) * 10
    ) / 10
    : null;

  return {
    product,
    stats: {
      sold_units: soldUnits,
      paid_order_count: new Set(paidItems.map((item) => item.order.id)).size,
      gmv: productGmv,
      average_rating: averageRating,
      rating_count: ratings.length,
    },
    recent_orders: paidItems.slice(0, 10).map((item) => ({
      id: item.order.id,
      status: item.order.status,
      total: item.order.total,
      qty: item.qty,
      price_at_purchase: item.price_at_purchase,
      created_at: item.order.created_at,
      buyer: item.order.buyer,
    })),
    ratings: ratings.map((rating) => ({
      id: rating.id,
      rating: rating.rating,
      comment: rating.comment,
      created_at: rating.created_at,
      buyer: rating.buyer,
    })),
    audit_history: auditResult.error
      ? { available: false, message: 'Audit log belum aktif.', data: [] }
      : { available: true, data: auditResult.data || [] },
  };
};

const moderateProduct = async (actor, productId, payload) => {
  const { data: product, error: findError } = await supabase
    .from('products')
    .select('id, seller_id, name, is_active, stock')
    .eq('id', productId)
    .single();

  if (findError || !product) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  }
  if (payload.is_active && product.stock <= 0) {
    throw {
      status: 400,
      code: 'OUT_OF_STOCK',
      message: 'Produk dengan stok habis tidak dapat diaktifkan',
    };
  }

  const { data, error } = await supabase
    .from('products')
    .update({ is_active: payload.is_active })
    .eq('id', productId)
    .select('id, seller_id, name, is_active, stock')
    .single();

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  await writeAuditLog({
    actorId: actor.id,
    action: payload.is_active ? 'product.activated' : 'product.deactivated',
    targetType: 'product',
    targetId: productId,
    reason: payload.reason,
    before: { is_active: product.is_active },
    after: {
      is_active: payload.is_active,
      moderation_rule: payload.rule,
      seller_id: product.seller_id,
    },
  });

  return data;
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
    sellersResult,
    ratingsResult,
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
    supabase.from('users').select('id, is_active').eq('role', 'seller'),
    supabase.from('ratings').select('rating, created_at').gte('created_at', toIso(period.start)).lte('created_at', endIso),
  ]);

  if (ordersResult.error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: ordersResult.error.message };
  }

  const allOrders = ordersResult.data || [];
  const allUsers = usersResult.data || [];
  const products = productsResult.data || [];
  const orderItems = itemsResult.data || [];
  const sellers = sellersResult.data || [];
  const ratings = ratingsResult.error ? [] : (ratingsResult.data || []);
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
      href: '/admin/moderation?status=active&stock=low',
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

  const paymentScore = clampScore(100 - summary.payment_failure_rate * 2);
  const paidOrderCount = currentOrders.filter((order) => PAID_STATUSES.has(order.status)).length;
  const trackedPaidCount = currentOrders.filter(
    (order) => PAID_STATUSES.has(order.status) && order.tracking_id
  ).length;
  const shippingCoverage = paidOrderCount ? (trackedPaidCount / paidOrderCount) * 100 : 100;
  const shippingScore = clampScore(
    shippingCoverage - (paidOrderCount ? (delayedPaidOrders.length / paidOrderCount) * 40 : 0)
  );
  const activeProducts = products.filter((product) => product.is_active);
  const healthyStockProducts = activeProducts.filter((product) => product.stock > 5);
  const stockScore = clampScore(
    activeProducts.length ? (healthyStockProducts.length / activeProducts.length) * 100 : 100
  );
  const activeSellerCount = sellers.filter((seller) => seller.is_active).length;
  const sellerActivation = sellers.length ? (activeSellerCount / sellers.length) * 100 : 100;
  const sellerScore = clampScore(
    sellerActivation - (paidOrderCount ? (delayedPaidOrders.length / paidOrderCount) * 30 : 0)
  );
  const averageRating = ratings.length
    ? ratings.reduce((sum, rating) => sum + Number(rating.rating || 0), 0) / ratings.length
    : null;
  const deliveredCount = currentOrders.filter((order) => order.status === 'delivered').length;
  const buyerScore = clampScore(
    averageRating !== null
      ? (averageRating / 5) * 100
      : paidOrderCount
        ? (deliveredCount / paidOrderCount) * 100
        : 100
  );
  const healthComponents = [
    {
      key: 'payment',
      label: 'Kesehatan Pembayaran',
      score: paymentScore,
      weight: 30,
      metric: `${summary.payment_failure_rate}% payment failure`,
      explanation: 'Skor turun dua poin untuk setiap satu persen payment failure.',
      href: '/admin/orders?status=payment_failed',
    },
    {
      key: 'shipping',
      label: 'Kesehatan Pengiriman',
      score: shippingScore,
      weight: 25,
      metric: paidOrderCount
        ? `${trackedPaidCount}/${paidOrderCount} paid order memiliki tracking`
        : 'Belum ada paid order pada periode ini',
      explanation: 'Mengukur cakupan tracking dan penalti order paid terlambat lebih dari 24 jam.',
      href: '/admin/orders?status=paid',
    },
    {
      key: 'stock',
      label: 'Ketersediaan Stok',
      score: stockScore,
      weight: 20,
      metric: `${healthyStockProducts.length}/${activeProducts.length} produk aktif memiliki stok > 5`,
      explanation: 'Produk aktif dengan stok lima atau kurang dianggap membutuhkan perhatian.',
      href: '/admin/moderation?status=active&stock=low',
    },
    {
      key: 'seller',
      label: 'Kualitas Seller',
      score: sellerScore,
      weight: 15,
      metric: `${activeSellerCount}/${sellers.length} seller aktif`,
      explanation: 'Menggabungkan status akun seller dan penalti keterlambatan pemrosesan order.',
      href: '/admin/moderation',
    },
    {
      key: 'buyer',
      label: 'Kepuasan Buyer',
      score: buyerScore,
      weight: 10,
      metric: averageRating !== null
        ? `Rating rata-rata ${Math.round(averageRating * 10) / 10}/5 dari ${ratings.length} ulasan`
        : paidOrderCount
          ? `${deliveredCount}/${paidOrderCount} paid order selesai (proxy karena belum ada rating periode ini)`
          : 'Belum ada paid order atau rating pada periode ini',
      explanation: averageRating !== null
        ? 'Skor berasal dari rating buyer pada periode terpilih.'
        : 'Tanpa rating, rasio order selesai dipakai sebagai proxy dan ditandai transparan.',
      href: '/admin/analytics',
    },
  ];
  const overallHealthScore = clampScore(
    healthComponents.reduce((sum, component) => sum + component.score * component.weight, 0) / 100
  );

  const previousFailureRate = previousSummary.payment_failure_rate;
  const averageOrderValue = summary.average_order_value;
  const unusualOrderThreshold = Math.max(1000000, averageOrderValue * 3);
  const unusualOrders = currentOrders.filter((order) => Number(order.total || 0) >= unusualOrderThreshold);
  const emptyActiveProducts = products.filter((product) => product.is_active && product.stock <= 0);
  const anomalies = [];
  if (
    paymentFailed.length >= 3 &&
    summary.payment_failure_rate >= previousFailureRate + 10
  ) {
    anomalies.push({
      key: 'payment_failure_spike',
      severity: 'high',
      title: 'Payment failure meningkat tajam',
      description: `${summary.payment_failure_rate}% pada periode ini, sebelumnya ${previousFailureRate}%.`,
      count: paymentFailed.length,
      rule: 'Minimal 3 kegagalan dan kenaikan sekurangnya 10 poin persentase.',
      href: '/admin/orders?status=payment_failed',
    });
  }
  if (unusualOrders.length > 0) {
    anomalies.push({
      key: 'unusual_order_value',
      severity: 'medium',
      title: 'Order bernilai tidak biasa',
      description: `Total order sekurangnya ${Math.round(unusualOrderThreshold).toLocaleString('id-ID')}.`,
      count: unusualOrders.length,
      rule: 'Nilai order minimal tiga kali AOV atau Rp1.000.000.',
      href: '/admin/orders?sort=total_desc',
    });
  }
  if (emptyActiveProducts.length > 0) {
    anomalies.push({
      key: 'active_product_empty_stock',
      severity: 'medium',
      title: 'Produk aktif kehabisan stok',
      description: 'Listing masih aktif meskipun stok sudah nol.',
      count: emptyActiveProducts.length,
      rule: 'is_active=true dan stock=0.',
      href: '/admin/moderation?status=active&stock=empty',
    });
  }
  if (delayedPaidOrders.length > 0) {
    anomalies.push({
      key: 'paid_order_shipping_delay',
      severity: 'high',
      title: 'Order paid terlambat dikirim',
      description: 'Order belum memiliki tracking setelah lebih dari 24 jam.',
      count: delayedPaidOrders.length,
      rule: 'status=paid, tracking kosong, dan updated_at lebih dari 24 jam.',
      href: '/admin/orders?status=paid',
    });
  }
  if (stalePending.length > 0) {
    anomalies.push({
      key: 'stale_pending_order',
      severity: 'low',
      title: 'Order pending terlalu lama',
      description: 'Checkout belum bergerak ke pembayaran setelah lebih dari 24 jam.',
      count: stalePending.length,
      rule: 'status=pending dan created_at lebih dari 24 jam.',
      href: '/admin/orders?status=pending',
    });
  }
  if (!integrationHealth.available || integrationErrors > 0) {
    anomalies.push({
      key: 'integration_observability',
      severity: integrationErrors > 0 ? 'high' : 'low',
      title: integrationErrors > 0 ? 'Error integrasi terdeteksi' : 'Monitoring integrasi belum aktif',
      description: integrationErrors > 0
        ? `${integrationErrors} error Gateway pada periode terpilih.`
        : 'Migration observability diperlukan agar anomali integrasi dapat dihitung.',
      count: integrationErrors || 1,
      rule: 'Error Gateway > 0 atau sumber observability tidak tersedia.',
      href: '/admin/analytics',
    });
  }

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
    marketplace_health: {
      score: overallHealthScore,
      status: overallHealthScore >= 85 ? 'healthy' : overallHealthScore >= 65 ? 'attention' : 'critical',
      formula: 'payment 30% + shipping 25% + stock 20% + seller 15% + buyer 10%',
      components: healthComponents,
      data_notes: [
        ratingsResult.error
          ? 'Tabel rating tidak tersedia; kepuasan buyer memakai proxy order selesai.'
          : ratings.length === 0
            ? 'Belum ada rating pada periode ini; kepuasan buyer memakai proxy order selesai.'
            : 'Kepuasan buyer memakai rating aktual.',
        integrationHealth.available
          ? 'Integration health termasuk dalam anomaly monitoring.'
          : 'Integration health belum aktif dan tidak mengubah bobot skor utama.',
      ],
    },
    anomalies,
    anomaly_coverage: [
      { rule: 'Payment failure spike', available: true },
      { rule: 'Order bernilai tidak biasa', available: true },
      { rule: 'Produk aktif stok habis', available: true },
      { rule: 'Order paid terlambat dikirim', available: true },
      { rule: 'Seller cancellation spike', available: false, reason: 'Status cancelled belum tersedia pada schema order.' },
    ],
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

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '';
  const [name, domain] = email.split('@');
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${'*'.repeat(Math.max(2, name.length - visible.length))}@${domain}`;
};

const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  let normalized = String(value).replace(/\r?\n/g, ' ');
  if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
  return /[",;]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
};

const rowsToCsv = (columns, rows) => {
  const header = columns.map((column) => escapeCsv(column.label)).join(',');
  const body = rows.map((row) =>
    columns.map((column) => escapeCsv(row[column.key])).join(',')
  );
  return `\uFEFF${[header, ...body].join('\n')}`;
};

const reportDateIso = (value, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}+07:00`);
  if (Number.isNaN(date.getTime())) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Filter tanggal tidak valid' };
  }
  return date.toISOString();
};

const buildReport = async (query) => {
  const type = query.type;
  if (!REPORT_TYPES.has(type)) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Jenis laporan tidak valid' };
  }

  if (type === 'analytics') {
    const analytics = await getAnalytics({
      ...query,
      start: query.start ? reportDateIso(query.start) : undefined,
      end: query.end ? reportDateIso(query.end, true) : undefined,
    });
    const columns = [
      { key: 'metric', label: 'Metrik' },
      { key: 'value', label: 'Nilai' },
      { key: 'period_start', label: 'Periode Mulai' },
      { key: 'period_end', label: 'Periode Akhir' },
    ];
    const labels = {
      gmv: 'GMV',
      marketplace_revenue: 'Revenue Marketplace',
      paid_orders: 'Paid Orders',
      total_orders: 'Total Orders',
      average_order_value: 'Average Order Value',
      payment_failure_rate: 'Payment Failure Rate (%)',
      active_buyers: 'Buyer Aktif',
      active_sellers: 'Seller Aktif',
      new_users: 'User Baru',
      total_products: 'Total Produk',
      low_stock_products: 'Produk Stok Kritis',
    };
    const rows = Object.entries(analytics.summary).map(([metric, value]) => ({
      metric: labels[metric] || metric,
      value,
      period_start: analytics.period.start,
      period_end: analytics.period.end,
    }));
    return { type, columns, rows };
  }

  if (type === 'orders') {
    let dbQuery = supabase
      .from('orders')
      .select('id, buyer_id, status, subtotal, fee_marketplace, total, transaction_id, tracking_id, created_at, updated_at, buyer:users!buyer_id(name, email)')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (query.status && ['pending', 'paid', 'processing', 'shipped', 'delivered', 'payment_failed'].includes(query.status)) {
      dbQuery = dbQuery.eq('status', query.status);
    }
    if (query.start) dbQuery = dbQuery.gte('created_at', reportDateIso(query.start));
    if (query.end) dbQuery = dbQuery.lte('created_at', reportDateIso(query.end, true));
    const { data, error } = await dbQuery;
    if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
    const term = query.search?.trim().toLowerCase();
    const filtered = term ? (data || []).filter((order) =>
      order.id.toLowerCase().includes(term) ||
      order.transaction_id?.toLowerCase().includes(term) ||
      order.tracking_id?.toLowerCase().includes(term) ||
      order.buyer?.name?.toLowerCase().includes(term) ||
      order.buyer?.email?.toLowerCase().includes(term)
    ) : (data || []);
    const columns = [
      { key: 'order_id', label: 'Order ID' },
      { key: 'buyer', label: 'Buyer' },
      { key: 'buyer_email_masked', label: 'Email Buyer (Masked)' },
      { key: 'status', label: 'Status' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'fee_marketplace', label: 'Fee Marketplace' },
      { key: 'total', label: 'Total' },
      { key: 'transaction_id', label: 'Transaction ID' },
      { key: 'tracking_id', label: 'Tracking ID' },
      { key: 'created_at', label: 'Dibuat' },
      { key: 'updated_at', label: 'Diperbarui' },
    ];
    return {
      type,
      columns,
      rows: filtered.map((order) => ({
        order_id: order.id,
        buyer: order.buyer?.name || '',
        buyer_email_masked: maskEmail(order.buyer?.email),
        status: order.status,
        subtotal: order.subtotal,
        fee_marketplace: order.fee_marketplace,
        total: order.total,
        transaction_id: order.transaction_id,
        tracking_id: order.tracking_id,
        created_at: order.created_at,
        updated_at: order.updated_at,
      })),
    };
  }

  if (type === 'users' || type === 'sellers') {
    let dbQuery = supabase
      .from('users')
      .select('id, name, email, role, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (type === 'sellers') dbQuery = dbQuery.eq('role', 'seller');
    else if (query.role && VALID_ROLES.has(query.role)) dbQuery = dbQuery.eq('role', query.role);
    if (query.status && VALID_USER_STATUSES.has(query.status)) {
      dbQuery = dbQuery.eq('is_active', query.status === 'active');
    }
    if (query.start) dbQuery = dbQuery.gte('created_at', reportDateIso(query.start));
    if (query.end) dbQuery = dbQuery.lte('created_at', reportDateIso(query.end, true));
    const { data, error } = await dbQuery;
    if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
    const term = query.search?.trim().toLowerCase();
    const filtered = term ? (data || []).filter((user) =>
      user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term)
    ) : (data || []);
    const columns = [
      { key: 'user_id', label: 'User ID' },
      { key: 'name', label: 'Nama' },
      { key: 'email_masked', label: 'Email (Masked)' },
      { key: 'role', label: 'Role' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Tanggal Daftar' },
    ];
    return {
      type,
      columns,
      rows: filtered.map((user) => ({
        user_id: user.id,
        name: user.name,
        email_masked: maskEmail(user.email),
        role: user.role,
        status: user.is_active ? 'active' : 'inactive',
        created_at: user.created_at,
      })),
    };
  }

  let dbQuery = supabase
    .from('products')
    .select('id, name, category, price, stock, is_active, created_at, seller:users!seller_id(id, name, email)')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (query.status === 'active') dbQuery = dbQuery.eq('is_active', true);
  if (query.status === 'inactive') dbQuery = dbQuery.eq('is_active', false);
  if (query.category) dbQuery = dbQuery.eq('category', query.category);
  if (query.stock === 'low') dbQuery = dbQuery.lte('stock', 5);
  if (query.stock === 'empty') dbQuery = dbQuery.eq('stock', 0);
  if (query.start) dbQuery = dbQuery.gte('created_at', reportDateIso(query.start));
  if (query.end) dbQuery = dbQuery.lte('created_at', reportDateIso(query.end, true));
  const { data, error } = await dbQuery;
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  const term = query.search?.trim().toLowerCase();
  const filtered = term ? (data || []).filter((product) =>
    product.name.toLowerCase().includes(term) ||
    product.seller?.name?.toLowerCase().includes(term)
  ) : (data || []);
  const columns = [
    { key: 'product_id', label: 'Product ID' },
    { key: 'name', label: 'Produk' },
    { key: 'category', label: 'Kategori' },
    { key: 'seller', label: 'Seller' },
    { key: 'seller_email_masked', label: 'Email Seller (Masked)' },
    { key: 'price', label: 'Harga' },
    { key: 'stock', label: 'Stok' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Dibuat' },
  ];
  return {
    type,
    columns,
    rows: filtered.map((product) => ({
      product_id: product.id,
      name: product.name,
      category: product.category,
      seller: product.seller?.name || '',
      seller_email_masked: maskEmail(product.seller?.email),
      price: product.price,
      stock: product.stock,
      status: product.is_active ? 'active' : 'inactive',
      created_at: product.created_at,
    })),
  };
};

const previewReport = async (query) => {
  const report = await buildReport(query);
  return {
    type: report.type,
    row_count: report.rows.length,
    columns: report.columns.map((column) => column.label),
    sample: report.rows.slice(0, 3),
    truncated: report.rows.length >= 5000,
  };
};

const exportReport = async (actor, query) => {
  const report = await buildReport(query);
  await writeAuditLog({
    actorId: actor.id,
    action: 'report.exported',
    targetType: 'report',
    targetId: null,
    reason: `Export CSV ${report.type}`,
    after: {
      report_type: report.type,
      row_count: report.rows.length,
      filters: query,
    },
  });
  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `pasarkita-${report.type}-${date}.csv`,
    csv: rowsToCsv(report.columns, report.rows),
  };
};

const simulateFeeImpact = async (query) => {
  const period = parsePeriod({
    ...query,
    start: query.start ? reportDateIso(query.start) : undefined,
    end: query.end ? reportDateIso(query.end, true) : undefined,
  });
  const customRate = Number(query.rate ?? 2);
  if (!Number.isFinite(customRate) || customRate < 0 || customRate > 10) {
    throw {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Fee simulasi harus berada pada rentang 0 sampai 10 persen',
    };
  }

  const { data, error } = await supabase
    .from('orders')
    .select('id, subtotal, fee_marketplace, total, status, created_at')
    .in('status', [...PAID_STATUSES])
    .gte('created_at', toIso(period.start))
    .lte('created_at', toIso(period.end))
    .limit(5000);

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  const orders = data || [];
  const subtotal = orders.reduce((sum, order) => sum + Number(order.subtotal || 0), 0);
  const actualRevenue = orders.reduce(
    (sum, order) => sum + Number(order.fee_marketplace || 0),
    0
  );
  const buildScenario = (rate) => {
    const simulatedRevenue = orders.reduce(
      (sum, order) => sum + Math.round(Number(order.subtotal || 0) * (rate / 100)),
      0
    );
    return {
      rate,
      revenue: simulatedRevenue,
      revenue_difference: simulatedRevenue - actualRevenue,
      average_fee_per_order: orders.length ? Math.round(simulatedRevenue / orders.length) : 0,
      buyer_total: subtotal + simulatedRevenue,
      average_buyer_total: orders.length ? Math.round((subtotal + simulatedRevenue) / orders.length) : 0,
    };
  };

  const rates = [...new Set([0, 1, 2, 3, 5, customRate])].sort((a, b) => a - b);
  return {
    period: {
      start: toIso(period.start),
      end: toIso(period.end),
      timezone: 'Asia/Jakarta',
    },
    baseline: {
      production_fee_rate: 2,
      paid_orders: orders.length,
      subtotal,
      actual_revenue: actualRevenue,
      actual_buyer_total: subtotal + actualRevenue,
    },
    selected_rate: customRate,
    selected_scenario: buildScenario(customRate),
    scenarios: rates.map(buildScenario),
    disclaimer: 'Simulasi hanya membaca data historis dan tidak mengubah fee produksi 2%.',
  };
};

module.exports = {
  getUsers,
  getUserById,
  getModerationSellers,
  getModerationProducts,
  getModerationProductById,
  moderateProduct,
  updateUserStatus,
  getAnalytics,
  getAuditLogs,
  previewReport,
  exportReport,
  simulateFeeImpact,
};
