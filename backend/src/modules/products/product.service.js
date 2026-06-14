const supabase = require('../../config/supabase');
const { randomUUID } = require('crypto');
const { kmpFilterProducts } = require('../../utils/kmp-search');

const PRODUCT_IMAGE_BUCKET = 'product-images';
const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const SELLER_PRODUCT_SORTS = {
  created_desc: ['created_at', false],
  created_asc: ['created_at', true],
  name_asc: ['name', true],
  name_desc: ['name', false],
  price_asc: ['price', true],
  price_desc: ['price', false],
  stock_asc: ['stock', true],
  stock_desc: ['stock', false],
  status_asc: ['is_active', true],
  status_desc: ['is_active', false],
};

const uploadProductImage = async (sellerId, file) => {
  if (!file) {
    throw { status: 400, code: 'IMAGE_REQUIRED', message: 'Pilih gambar produk terlebih dahulu' };
  }

  const { error: schemaError } = await supabase
    .from('products')
    .select('image_url')
    .limit(1);

  if (schemaError) {
    const imageColumnMissing = schemaError.message?.includes('products.image_url');
    throw {
      status: 503,
      code: imageColumnMissing ? 'IMAGE_SCHEMA_NOT_READY' : 'IMAGE_STORAGE_CHECK_FAILED',
      message: imageColumnMissing
        ? 'Kolom gambar produk belum aktif. Jalankan backend/database/migrations/001_product_images.sql di Supabase SQL Editor.'
        : `Gagal memeriksa konfigurasi gambar: ${schemaError.message}`,
    };
  }

  const extension = IMAGE_EXTENSIONS[file.mimetype];
  if (!extension) {
    throw {
      status: 400,
      code: 'INVALID_IMAGE_TYPE',
      message: 'Format gambar harus JPG, PNG, atau WebP',
    };
  }

  const path = `${sellerId}/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    const bucketMissing = error.message?.toLowerCase().includes('bucket');
    throw {
      status: 500,
      code: bucketMissing ? 'IMAGE_STORAGE_NOT_READY' : 'IMAGE_UPLOAD_FAILED',
      message: bucketMissing
        ? 'Storage gambar belum aktif. Jalankan backend/database/migrations/001_product_images.sql di Supabase.'
        : `Gagal mengunggah gambar: ${error.message}`,
    };
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return {
    image_url: data.publicUrl,
    path,
  };
};

const getProducts = async (query) => {
  // Parsing query
  const limit = Math.min(Math.max(parseInt(query.limit) || 10, 1), 100);
  const page = Math.max(parseInt(query.page) || 1, 1);
  const offset = (page - 1) * limit;

  let supaQuery = supabase
    .from('products')
    .select('*, seller:users(id, name)', { count: 'exact' });

  supaQuery = supaQuery.eq('is_active', true);

  if (query.category) {
    supaQuery = supaQuery.eq('category', query.category);
  }

  const minPrice = Number.parseInt(query.min_price, 10);
  if (Number.isFinite(minPrice) && minPrice >= 0) {
    supaQuery = supaQuery.gte('price', minPrice);
  }
  const maxPrice = Number.parseInt(query.max_price, 10);
  if (Number.isFinite(maxPrice) && maxPrice >= 0) {
    supaQuery = supaQuery.lte('price', maxPrice);
  }
  if (
    Number.isFinite(minPrice) &&
    Number.isFinite(maxPrice) &&
    minPrice > maxPrice
  ) {
    throw {
      status: 400,
      code: 'INVALID_PRICE_RANGE',
      message: 'Harga minimum tidak boleh lebih besar dari harga maksimum',
    };
  }
  if (query.in_stock === 'true') {
    supaQuery = supaQuery.gt('stock', 0);
  }

  if (query.seller_id) {
    supaQuery = supaQuery.eq('seller_id', query.seller_id);
  }

  // ══════════════════════════════════════════════════════════════
  // ALGORITMA STRING MATCHING — KMP (Knuth-Morris-Pratt)
  // Semua pencarian produk menggunakan KMP di level aplikasi.
  // Data difetch dari DB, lalu difilter KMP di memori.
  // Kompleksitas KMP: O(n + m) per produk
  // Dokumentasi: docs/algorithms/string-matching-algorithm.md
  // ══════════════════════════════════════════════════════════════

  if (query.sort === 'rating_desc' || query.sort === 'sold_desc') {
    // Saat sorting terlaris/rating, semua produk di-load ke memory.
    // Di sini kita gunakan KMP untuk string matching di level aplikasi.
    let allProducts;
    {
      const { data, error: productError } = await supaQuery
        .order('created_at', { ascending: false })
        .limit(1000);

      if (productError) {
        throw { status: 500, code: 'INTERNAL_ERROR', message: productError.message };
      }
      // KMP STRING MATCHING: Filter produk di memori menggunakan KMP
      allProducts = query.search
        ? kmpFilterProducts(data || [], query.search, 'name')
        : (data || []);
    }

    const productIds = (allProducts || []).map((product) => product.id);
    if (productIds.length === 0) {
      return { data: [], pagination: { page, limit, total: 0, total_pages: 0 } };
    }

    const [ratingsResult, salesResult] = await Promise.all([
      supabase.from('ratings').select('product_id, rating').in('product_id', productIds),
      supabase
        .from('order_items')
        .select('product_id, qty, order:orders!inner(status)')
        .in('product_id', productIds)
        .in('order.status', ['paid', 'processing', 'shipped', 'delivered']),
    ]);

    if (ratingsResult.error) {
      throw { status: 500, code: 'INTERNAL_ERROR', message: ratingsResult.error.message };
    }
    if (salesResult.error) {
      throw { status: 500, code: 'INTERNAL_ERROR', message: salesResult.error.message };
    }

    const ratingTotals = new Map();
    (ratingsResult.data || []).forEach((rating) => {
      const current = ratingTotals.get(rating.product_id) || { sum: 0, count: 0 };
      ratingTotals.set(rating.product_id, {
        sum: current.sum + rating.rating,
        count: current.count + 1,
      });
    });
    const soldTotals = new Map();
    (salesResult.data || []).forEach((item) => {
      soldTotals.set(item.product_id, (soldTotals.get(item.product_id) || 0) + item.qty);
    });

    // ══════════════════════════════════════════════════════════
    // ALGORITMA GREEDY — Ranking Produk Terlaris / Rating Tertinggi
    // Strategi: Hitung skor lokal per produk → sort → ambil halaman
    // Dokumentasi: docs/algorithms/greedy-algorithm.md
    // ══════════════════════════════════════════════════════════
    const rankedProducts = (allProducts || []).map((product) => {
      const rating = ratingTotals.get(product.id);
      return {
        ...product,
        rating_average: rating ? Math.round((rating.sum / rating.count) * 10) / 10 : null,
        rating_count: rating?.count || 0,
        sold_units: soldTotals.get(product.id) || 0,
      };
    }).sort((a, b) => {
      const primary = query.sort === 'rating_desc'
        ? (b.rating_average || 0) - (a.rating_average || 0)
        : b.sold_units - a.sold_units;
      if (primary !== 0) return primary;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return {
      data: rankedProducts.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total: rankedProducts.length,
        total_pages: Math.ceil(rankedProducts.length / limit),
      },
    };
  }

  // Handle sort (non-ranked: harga, terbaru)
  if (query.sort === 'price_asc') {
    supaQuery = supaQuery.order('price', { ascending: true });
  } else if (query.sort === 'price_desc') {
    supaQuery = supaQuery.order('price', { ascending: false });
  } else {
    supaQuery = supaQuery.order('created_at', { ascending: false }); // Default
  }

  // Fetch data lalu filter KMP + pagination manual
  const { data: rawData, error } = await supaQuery.limit(1000);

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  // KMP STRING MATCHING: Filter produk menggunakan KMP
  const filtered = query.search
    ? kmpFilterProducts(rawData || [], query.search, 'name')
    : (rawData || []);

  return {
    data: filtered.slice(offset, offset + limit),
    pagination: {
      page,
      limit,
      total: filtered.length,
      total_pages: Math.ceil(filtered.length / limit)
    }
  };
};

const getProductById = async (id) => {
  const { data, error } = await supabase
    .from('products')
    .select('*, seller:users(id, name, email)')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  }
  return data;
};

const getPublicStore = async (sellerId) => {
  const [{ data: seller, error: sellerError }, profileResult] = await Promise.all([
    supabase
    .from('users')
    .select('id, name, created_at, is_active')
    .eq('id', sellerId)
    .eq('role', 'seller')
    .single(),
    supabase
      .from('seller_profiles')
      .select('store_name, logo_url, description, contact_phone, open_time, close_time, processing_days, verification_status')
      .eq('seller_id', sellerId)
      .maybeSingle(),
  ]);

  if (sellerError || !seller || !seller.is_active) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Toko tidak ditemukan' };
  }
  const profile = profileResult.error ? null : profileResult.data;

  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('seller_id', sellerId)
    .eq('is_active', true);

  if (productError) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: productError.message };
  }

  const productIds = (products || []).map((product) => product.id);
  if (productIds.length === 0) {
    return {
      seller: {
        ...seller,
        store_name: profile?.store_name || seller.name,
        logo_url: profile?.logo_url || null,
        description: profile?.description || null,
        contact_phone: profile?.contact_phone || null,
        open_time: profile?.open_time || null,
        close_time: profile?.close_time || null,
        processing_days: profile?.processing_days || null,
        verification_status: profile?.verification_status || 'unverified',
      },
      stats: {
        active_products: 0,
        sold_units: 0,
        rating_average: null,
        rating_count: 0,
        tracking_coverage: null,
      },
    };
  }

  const [ratingsResult, orderItemsResult] = await Promise.all([
    supabase.from('ratings').select('rating').in('product_id', productIds),
    supabase
      .from('order_items')
      .select('qty, order_id, order:orders!inner(status, tracking_id)')
      .in('product_id', productIds)
      .in('order.status', ['paid', 'processing', 'shipped', 'delivered']),
  ]);

  if (ratingsResult.error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: ratingsResult.error.message };
  }
  if (orderItemsResult.error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: orderItemsResult.error.message };
  }

  const ratings = ratingsResult.data || [];
  const orderItems = orderItemsResult.data || [];
  const orderTracking = new Map();
  orderItems.forEach((item) => {
    orderTracking.set(item.order_id, Boolean(item.order?.tracking_id));
  });
  const trackedOrders = [...orderTracking.values()].filter(Boolean).length;

  return {
    seller: {
      ...seller,
      store_name: profile?.store_name || seller.name,
      logo_url: profile?.logo_url || null,
      description: profile?.description || null,
      contact_phone: profile?.contact_phone || null,
      open_time: profile?.open_time || null,
      close_time: profile?.close_time || null,
      processing_days: profile?.processing_days || null,
      verification_status: profile?.verification_status || 'unverified',
    },
    stats: {
      active_products: productIds.length,
      sold_units: orderItems.reduce((sum, item) => sum + item.qty, 0),
      rating_average: ratings.length > 0
        ? Math.round((ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length) * 10) / 10
        : null,
      rating_count: ratings.length,
      tracking_coverage: orderTracking.size > 0
        ? Math.round((trackedOrders / orderTracking.size) * 100)
        : null,
    },
  };
};

// Seller routes
const getProductsBySeller = async (sellerId, query) => {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;
  const [sortColumn, sortAscending] =
    SELLER_PRODUCT_SORTS[query.sort] || SELLER_PRODUCT_SORTS.created_desc;
  let dbQuery = supabase
    .from('products')
    .select('*')
    .eq('seller_id', sellerId)
    .order(sortColumn, { ascending: sortAscending });

  if (query.status === 'active') {
    dbQuery = dbQuery.eq('is_active', true);
  } else if (query.status === 'inactive') {
    dbQuery = dbQuery.eq('is_active', false);
  }
  if (query.stock === 'out') {
    dbQuery = dbQuery.eq('stock', 0);
  } else if (query.stock === 'low') {
    dbQuery = dbQuery.eq('is_low_stock', true);
  }

  // Fetch semua data lalu filter KMP + pagination manual
  const { data: rawData, error } = await dbQuery.limit(5000); // Ambil lebih banyak untuk pagination manual

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  // KMP STRING MATCHING: Filter produk menggunakan KMP
  const filtered = query.search?.trim()
    ? kmpFilterProducts(rawData || [], query.search.trim(), 'name')
    : (rawData || []);

  return {
    data: filtered.slice(offset, offset + limit),
    pagination: {
      page,
      limit,
      total: filtered.length,
      total_pages: Math.ceil(filtered.length / limit),
    }
  };
}

const getProductBySeller = async (sellerId, productId) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .single();

  if (error || !data) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Produk seller tidak ditemukan' };
  }
  return data;
};

const createProduct = async (sellerId, payload) => {
  const isActive = payload.is_active === false ? false : payload.stock > 0;
  
  const { data, error } = await supabase
    .from('products')
    .insert([
      { ...payload, seller_id: sellerId, is_active: isActive }
    ])
    .select()
    .single();

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const updateProduct = async (user, productId, payload) => {
  // Check ownership
  const { data: prod } = await supabase.from('products').select('seller_id').eq('id', productId).single();
  if (!prod) throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  
  if (prod.seller_id !== user.id && user.role !== 'superadmin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Akses ditolak' };
  }

  if (user.role === 'seller' && payload.is_active === true) {
    const { data: latestDecision, error: auditError } = await supabase
      .from('admin_audit_logs')
      .select('action, reason, created_at')
      .eq('target_type', 'product')
      .eq('target_id', productId)
      .in('action', ['product.activated', 'product.deactivated'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (auditError) {
      throw {
        status: 403,
        code: 'ADMIN_APPROVAL_REQUIRED',
        message: 'Produk nonaktif memerlukan persetujuan admin untuk diaktifkan kembali',
      };
    }
    if (latestDecision?.action === 'product.deactivated') {
      throw {
        status: 403,
        code: 'ADMIN_MODERATION_LOCK',
        message: `Produk dikunci oleh admin: ${latestDecision.reason || 'menunggu review ulang'}`,
      };
    }
  }

  if (payload.stock !== undefined && payload.stock <= 0) {
    payload.is_active = false;
  }

  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', productId)
    .select()
    .single();

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const deleteProduct = async (user, productId) => {
  // Check ownership
  const { data: prod } = await supabase.from('products').select('seller_id').eq('id', productId).single();
  if (!prod) throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  
  if (prod.seller_id !== user.id && user.role !== 'superadmin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Akses ditolak' };
  }

  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', productId);

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return { success: true };
};


const exportProductsBySeller = async (sellerId, query) => {
  let dbQuery = supabase
    .from('products')
    .select('id, name, category, description, price, stock, minimum_stock, is_low_stock, is_active, image_url, created_at, updated_at')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (query.status === 'active') {
    dbQuery = dbQuery.eq('is_active', true);
  } else if (query.status === 'inactive') {
    dbQuery = dbQuery.eq('is_active', false);
  }
  if (query.stock === 'out') {
    dbQuery = dbQuery.eq('stock', 0);
  } else if (query.stock === 'low') {
    dbQuery = dbQuery.eq('is_low_stock', true);
  }
  const { data: rawData, error } = await dbQuery;
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  // KMP STRING MATCHING: Filter produk menggunakan KMP untuk export
  const data = query.search?.trim()
    ? kmpFilterProducts(rawData || [], query.search.trim(), 'name')
    : (rawData || []);

  const rows = data || [];
  const headers = ['ID', 'Nama Produk', 'Kategori', 'Deskripsi', 'Harga', 'Stok', 'Stok Minimum', 'Status', 'Gambar URL', 'Dibuat', 'Diperbarui'];
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.join(','),
    ...rows.map((row) => [
      row.id,
      escapeCSV(row.name),
      escapeCSV(row.category),
      escapeCSV(row.description),
      row.price,
      row.stock,
      row.minimum_stock ?? '',
      row.is_active ? 'Aktif' : 'Nonaktif',
      escapeCSV(row.image_url),
      row.created_at ? new Date(row.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '',
      row.updated_at ? new Date(row.updated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '',
    ].join(',')),
  ];

  return {
    csv: lines.join('\r\n'),
    count: rows.length,
    truncated: rows.length >= 5000,
  };
};

module.exports = {
  getProducts,
  getProductById,
  getPublicStore,
  getProductsBySeller,
  getProductBySeller,
  uploadProductImage,
  createProduct,
  updateProduct,
  deleteProduct,
  exportProductsBySeller,
};

