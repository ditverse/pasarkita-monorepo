const supabase = require('../../config/supabase');

const getOrders = async (user, query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const offset = (page - 1) * limit;

  let supaQuery = supabase
    .from('orders')
    .select('*, items:order_items(product_id, qty, price_at_purchase, product:products(id, name))', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (user.role === 'buyer') {
    supaQuery = supaQuery.eq('buyer_id', user.id);
  }
  // seller dan superadmin lihat semua orders
  // (orders tidak punya kolom seller_id — otorisasi per-order ada di getOrderById)

  if (query.status) {
    supaQuery = supaQuery.eq('status', query.status);
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
    .select('*, items:order_items(product_id, qty, price_at_purchase, product:products(id, name)), buyer:users!buyer_id(id, name, email)')
    .eq('id', orderId)
    .single();

  if (error || !data) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Order tidak ditemukan' };
  }

  if (user.role !== 'superadmin' && data.buyer_id !== user.id) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Akses ditolak' };
  }

  // Reshape items agar field name sesuai PRD
  const reshapedItems = (data.items || []).map((item) => ({
    product_id: item.product_id,
    product_name: item.product?.name ?? 'Produk dihapus',
    qty: item.qty,
    price_at_purchase: item.price_at_purchase,
  }));

  return { ...data, items: reshapedItems };
};

const updateOrderStatus = async (orderId, status) => {
  const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'payment_failed'];
  if (!validStatuses.includes(status)) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: `Status tidak valid. Pilihan: ${validStatuses.join(', ')}` };
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
  return data;
};

module.exports = { getOrders, getOrderById, updateOrderStatus };
