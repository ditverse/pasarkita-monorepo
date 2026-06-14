const supabase = require('../../config/supabase');
const { randomUUID } = require('crypto');

const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_STATUSES = new Set(['paid', 'processing', 'shipped', 'delivered']);
const STORE_ASSET_BUCKET = 'store-assets';
const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

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

const bucketKey = (iso) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const parsePeriod = (query) => {
  // Custom date range: date_from dan date_to dalam format YYYY-MM-DD (WIB)
  if (query.date_from && query.date_to) {
    const start = new Date(`${query.date_from}T00:00:00+07:00`);
    const end = new Date(`${query.date_to}T23:59:59.999+07:00`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      const diffMs = end.getTime() - start.getTime();
      const days = Math.max(1, Math.ceil(diffMs / DAY_MS));
      if (days <= 366) {
        return { days, start, end };
      }
    }
  }
  // Preset 7d / 30d
  const days = query.period === '7d' ? 7 : 30;
  const end = new Date();
  const start = startOfJakartaDay(new Date(end.getTime() - (days - 1) * DAY_MS));
  return { days, start, end };
};

const getSellerAnalytics = async (sellerId, query) => {
  const period = parsePeriod(query);
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, category, stock, minimum_stock, is_low_stock, is_active, image_url')
    .eq('seller_id', sellerId);

  if (productsError) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: productsError.message };
  }

  const productIds = (products || []).map((product) => product.id);
  if (productIds.length === 0) {
    return {
      period: { days: period.days, start: startIso, end: endIso, generated_at: new Date().toISOString() },
      summary: {
        gross_sales: 0,
        marketplace_fee: 0,
        estimated_net: 0,
        paid_orders: 0,
        new_orders: 0,
        overdue_orders: 0,
        out_of_stock: 0,
        low_stock: 0,
        average_rating: null,
        new_reviews: 0,
      },
      timeseries: [],
      orders_by_status: [],
      top_products: [],
      critical_stock: [],
    };
  }

  const [itemsResult, ratingsResult] = await Promise.all([
    supabase
      .from('order_items')
      .select('order_id, product_id, qty, price_at_purchase, order:orders!inner(id, status, subtotal, fee_marketplace, created_at, processing_at)')
      .in('product_id', productIds)
      .gte('order.created_at', startIso)
      .lte('order.created_at', endIso),
    supabase
      .from('ratings')
      .select('rating, created_at')
      .in('product_id', productIds),
  ]);

  if (itemsResult.error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: itemsResult.error.message };
  }
  if (ratingsResult.error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: ratingsResult.error.message };
  }

  const productById = new Map((products || []).map((product) => [product.id, product]));
  const orderMap = new Map();
  const productSales = new Map();
  const buckets = new Map();

  for (const item of itemsResult.data || []) {
    const order = item.order;
    if (!order) continue;
    const itemGross = Number(item.qty) * Number(item.price_at_purchase);
    const feeShare = Number(order.subtotal) > 0
      ? Math.round(Number(order.fee_marketplace || 0) * (itemGross / Number(order.subtotal)))
      : 0;
    const currentOrder = orderMap.get(order.id) || {
      ...order,
      gross: 0,
      fee: 0,
    };
    currentOrder.gross += itemGross;
    currentOrder.fee += feeShare;
    orderMap.set(order.id, currentOrder);

    if (PAID_STATUSES.has(order.status)) {
      const product = productById.get(item.product_id);
      const currentProduct = productSales.get(item.product_id) || {
        product_id: item.product_id,
        name: product?.name || 'Produk dihapus',
        sold: 0,
        gross_sales: 0,
      };
      currentProduct.sold += Number(item.qty);
      currentProduct.gross_sales += itemGross;
      productSales.set(item.product_id, currentProduct);
    }
  }

  const orders = [...orderMap.values()];
  const paidOrders = orders.filter((order) => PAID_STATUSES.has(order.status));
  const grossSales = paidOrders.reduce((sum, order) => sum + order.gross, 0);
  const marketplaceFee = paidOrders.reduce((sum, order) => sum + order.fee, 0);
  const overdueCutoff = Date.now() - 2 * DAY_MS;
  const overdueOrders = orders.filter((order) => {
    if (order.status === 'paid') return new Date(order.created_at).getTime() < overdueCutoff;
    if (order.status === 'processing') {
      return new Date(order.processing_at || order.created_at).getTime() < overdueCutoff;
    }
    return false;
  }).length;

  for (const order of orders) {
    const key = bucketKey(order.created_at);
    const bucket = buckets.get(key) || {
      bucket: key,
      gross_sales: 0,
      estimated_net: 0,
      orders: 0,
    };
    bucket.orders += 1;
    if (PAID_STATUSES.has(order.status)) {
      bucket.gross_sales += order.gross;
      bucket.estimated_net += order.gross - order.fee;
    }
    buckets.set(key, bucket);
  }

  const statusCounts = new Map();
  for (const order of orders) {
    statusCounts.set(order.status, (statusCounts.get(order.status) || 0) + 1);
  }

  const ratings = ratingsResult.data || [];
  const newReviews = ratings.filter(
    (rating) => new Date(rating.created_at).getTime() >= period.start.getTime()
  ).length;
  const averageRating = ratings.length
    ? Math.round((ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length) * 10) / 10
    : null;
  const criticalStock = (products || [])
    .filter((product) => product.stock === 0 || product.is_low_stock)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 10)
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock,
      minimum_stock: product.minimum_stock,
      status: product.stock === 0 ? 'out' : 'low',
    }));

  const totalOrders = orders.length;
  return {
    period: {
      days: period.days,
      start: startIso,
      end: endIso,
      generated_at: new Date().toISOString(),
    },
    summary: {
      gross_sales: grossSales,
      marketplace_fee: marketplaceFee,
      estimated_net: grossSales - marketplaceFee,
      paid_orders: paidOrders.length,
      new_orders: orders.filter((order) => order.status === 'paid').length,
      overdue_orders: overdueOrders,
      out_of_stock: (products || []).filter((product) => product.stock === 0).length,
      low_stock: (products || []).filter((product) => product.is_low_stock).length,
      average_rating: averageRating,
      new_reviews: newReviews,
    },
    timeseries: [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
    orders_by_status: [...statusCounts.entries()].map(([key, count]) => ({
      key,
      count,
      pct: totalOrders ? Math.round((count / totalOrders) * 1000) / 10 : 0,
    })),
    top_products: [...productSales.values()]
      .sort((a, b) => b.sold - a.sold || b.gross_sales - a.gross_sales)
      .slice(0, 5),
    critical_stock: criticalStock,
  };
};

const ensureSellerProfile = async (sellerId) => {
  const { data: existing, error: existingError } = await supabase
    .from('seller_profiles')
    .select('*')
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (existingError) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: existingError.message };
  }
  if (existing) return existing;

  const { data: seller, error: sellerError } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', sellerId)
    .eq('role', 'seller')
    .single();
  if (sellerError || !seller) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Seller tidak ditemukan' };
  }

  const { data, error } = await supabase
    .from('seller_profiles')
    .insert({ seller_id: sellerId, store_name: seller.name })
    .select()
    .single();
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const getStoreProfile = async (sellerId) => ensureSellerProfile(sellerId);

const updateStoreProfile = async (sellerId, payload) => {
  await ensureSellerProfile(sellerId);
  const complete = Boolean(
    payload.store_name &&
    payload.description &&
    payload.pickup_address &&
    payload.contact_phone
  );
  const { data, error } = await supabase
    .from('seller_profiles')
    .update({
      ...payload,
      verification_status: complete ? 'demo_verified' : 'unverified',
    })
    .eq('seller_id', sellerId)
    .select()
    .single();
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const uploadStoreLogo = async (sellerId, file) => {
  if (!file) {
    throw { status: 400, code: 'IMAGE_REQUIRED', message: 'Pilih logo toko terlebih dahulu' };
  }
  const extension = IMAGE_EXTENSIONS[file.mimetype];
  if (!extension) {
    throw { status: 400, code: 'INVALID_IMAGE_TYPE', message: 'Format logo harus JPG, PNG, atau WebP' };
  }

  const path = `${sellerId}/logo-${randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(STORE_ASSET_BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '31536000',
      upsert: false,
    });
  if (error) {
    throw { status: 500, code: 'STORE_LOGO_UPLOAD_FAILED', message: `Gagal mengunggah logo: ${error.message}` };
  }
  const { data } = supabase.storage.from(STORE_ASSET_BUCKET).getPublicUrl(path);
  return { logo_url: data.publicUrl, path };
};

const setVacationMode = async (sellerId, payload) => {
  await ensureSellerProfile(sellerId);

  const isVacation = Boolean(payload.is_on_vacation);
  let vacationUntil = null;

  if (isVacation && payload.vacation_until) {
    // Validasi format YYYY-MM-DD
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(payload.vacation_until)) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Format vacation_until harus YYYY-MM-DD' };
    }
    const until = new Date(`${payload.vacation_until}T00:00:00+07:00`);
    if (Number.isNaN(until.getTime())) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Tanggal aktif kembali tidak valid' };
    }
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (until < tomorrow) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Tanggal aktif kembali harus setidaknya besok' };
    }
    vacationUntil = payload.vacation_until;
  }

  const { data, error } = await supabase
    .from('seller_profiles')
    .update({
      is_on_vacation: isVacation,
      vacation_until: isVacation ? vacationUntil : null,
    })
    .eq('seller_id', sellerId)
    .select()
    .single();

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

module.exports = {
  getSellerAnalytics,
  getStoreProfile,
  updateStoreProfile,
  uploadStoreLogo,
  setVacationMode,
};
