const supabase = require('../../config/supabase');
const { randomUUID } = require('crypto');

const PRODUCT_IMAGE_BUCKET = 'product-images';
const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
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
        ? 'Kolom gambar produk belum aktif. Jalankan backend/product-images.sql di Supabase SQL Editor.'
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
        ? 'Storage gambar belum aktif. Jalankan backend/product-images.sql di Supabase.'
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
  const limit = parseInt(query.limit) || 10;
  const page = parseInt(query.page) || 1;
  const offset = (page - 1) * limit;

  let supaQuery = supabase
    .from('products')
    .select('*, seller:users(id, name)', { count: 'exact' });

  supaQuery = supaQuery.eq('is_active', true);

  if (query.category) {
    supaQuery = supaQuery.eq('category', query.category);
  }

  if (query.seller_id) {
    supaQuery = supaQuery.eq('seller_id', query.seller_id);
  }

  if (query.search) {
    supaQuery = supaQuery.ilike('name', `%${query.search}%`);
  }

  // Handle sort
  if (query.sort === 'price_asc') {
    supaQuery = supaQuery.order('price', { ascending: true });
  } else if (query.sort === 'price_desc') {
    supaQuery = supaQuery.order('price', { ascending: false });
  } else {
    supaQuery = supaQuery.order('created_at', { ascending: false }); // Default
  }

  supaQuery = supaQuery.range(offset, offset + limit - 1);

  const { data, count, error } = await supaQuery;

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  return {
    data: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit)
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

// Seller routes
const getProductsBySeller = async (sellerId, query) => {
  const limit = Math.min(parseInt(query.limit) || 50, 100);
  const page = parseInt(query.page) || 1;
  const offset = (page - 1) * limit;
  let dbQuery = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (query.search?.trim()) {
    dbQuery = dbQuery.ilike('name', `%${query.search.trim()}%`);
  }
  dbQuery = dbQuery.range(offset, offset + limit - 1);

  const { data, count, error } = await dbQuery;
  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  return {
    data: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit),
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
  const { data, error } = await supabase
    .from('products')
    .insert([
      { ...payload, seller_id: sellerId, is_active: payload.stock > 0 }
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

module.exports = {
  getProducts,
  getProductById,
  getProductsBySeller,
  getProductBySeller,
  uploadProductImage,
  createProduct,
  updateProduct,
  deleteProduct,
};
