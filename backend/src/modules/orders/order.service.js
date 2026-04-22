const supabase = require('../../config/supabase');

const getOrders = async (user, query) => {
  let supaQuery = supabase
    .from('orders')
    .select('*, items:order_items(*, product:products(*))')
    .order('created_at', { ascending: false });

  if (user.role === 'buyer') {
    supaQuery = supaQuery.eq('buyer_id', user.id);
  } else if (user.role === 'seller') {
    supaQuery = supaQuery.eq('seller_id', user.id);
  }
  // superadmin bisa lihat semua

  const { data, error } = await supaQuery;

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  return { data: data || [], pagination: {} };
};

const getOrderById = async (user, orderId) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*, product:products(*)), buyer:users!buyer_id(*), seller:users!seller_id(*)')
    .eq('id', orderId)
    .single();

  if (error || !data) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Order tidak ditemukan' };
  }

  if (user.role !== 'superadmin' && data.buyer_id !== user.id && data.seller_id !== user.id) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Akses ditolak' };
  }

  return data;
};

const updateOrderStatus = async (orderId, status) => {
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
