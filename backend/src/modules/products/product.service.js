const supabase = require('../../config/supabase');

const getProducts = async (query) => {
  // Parsing query
  const limit = parseInt(query.limit) || 10;
  const page = parseInt(query.page) || 1;
  const offset = (page - 1) * limit;

  let supaQuery = supabase
    .from('products')
    .select('*, seller:users(id, name)', { count: 'exact' })
    .eq('is_active', true);

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
    .single();

  if (error || !data) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  }
  return data;
};

// Seller routes
const getProductsBySeller = async (sellerId, query) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  return {
    data: data || [],
    pagination: {}
  };
}

const createProduct = async (sellerId, payload) => {
  const { data, error } = await supabase
    .from('products')
    .insert([
      { ...payload, seller_id: sellerId, is_active: true }
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

module.exports = { getProducts, getProductById, getProductsBySeller, createProduct, updateProduct, deleteProduct };
