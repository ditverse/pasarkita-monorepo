const supabase = require('../../config/supabase');

/**
 * Submit rating untuk produk setelah order delivered.
 * Satu order hanya bisa rating satu kali.
 */
const submitRating = async (buyerId, payload) => {
  const { order_id, product_id, rating, comment } = payload;

  if (!order_id || !product_id || !rating) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'order_id, product_id, dan rating wajib diisi' };
  }
  if (rating < 1 || rating > 5) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Rating harus antara 1 dan 5' };
  }

  // Validasi order milik buyer dan statusnya delivered
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, buyer_id, status')
    .eq('id', order_id)
    .single();

  if (orderErr || !order) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Order tidak ditemukan' };
  }
  if (order.buyer_id !== buyerId) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Bukan order Anda' };
  }
  if (order.status !== 'delivered') {
    throw { status: 400, code: 'INVALID_STATUS', message: 'Rating hanya bisa diberikan setelah pesanan selesai' };
  }

  // Cek apakah sudah pernah rating produk ini di order ini
  const { data: existing } = await supabase
    .from('ratings')
    .select('id')
    .eq('order_id', order_id)
    .eq('product_id', product_id)
    .single();

  if (existing) {
    throw { status: 409, code: 'ALREADY_RATED', message: 'Anda sudah memberikan ulasan untuk produk ini' };
  }

  // Insert rating
  const { data, error } = await supabase
    .from('ratings')
    .insert([{
      order_id,
      product_id,
      buyer_id: buyerId,
      rating,
      comment: comment?.trim() || null,
    }])
    .select()
    .single();

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  return data;
};

/**
 * Ambil semua rating untuk satu produk beserta summary.
 */
const getProductRatings = async (productId) => {
  const { data: ratings, error } = await supabase
    .from('ratings')
    .select('id, rating, comment, created_at, buyer:users!buyer_id(id, name)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  const list = ratings || [];
  const total = list.length;
  const average = total > 0
    ? Math.round((list.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
    : 0;

  // Distribusi per bintang
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  list.forEach((r) => { distribution[r.rating] = (distribution[r.rating] || 0) + 1; });

  const pct = {};
  Object.entries(distribution).forEach(([star, count]) => {
    pct[star] = total > 0 ? Math.round((count / total) * 100) : 0;
  });

  return {
    summary: { average, total, distribution: pct },
    reviews: list.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      date: r.created_at,
      buyer_name: r.buyer?.name ?? 'Pembeli',
    })),
  };
};

/**
 * Cek apakah buyer sudah rating produk di order tertentu.
 */
const checkRated = async (buyerId, orderId, productId) => {
  const { data } = await supabase
    .from('ratings')
    .select('id')
    .eq('order_id', orderId)
    .eq('product_id', productId)
    .eq('buyer_id', buyerId)
    .single();

  return !!data;
};

module.exports = { submitRating, getProductRatings, checkRated };
