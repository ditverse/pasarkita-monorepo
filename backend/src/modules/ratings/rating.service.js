const supabase = require('../../config/supabase');
const { randomUUID } = require('crypto');

const REVIEW_IMAGE_BUCKET = 'review-images';
const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_PHOTOS_PER_PRODUCT = 3;

/**
 * Upload foto ulasan ke Supabase Storage.
 * Dipanggil sebelum submitRating; return public URL.
 */
const uploadReviewImage = async (userId, file) => {
  if (!file) {
    throw { status: 400, code: 'FILE_REQUIRED', message: 'File gambar wajib dikirim' };
  }

  const extension = IMAGE_EXTENSIONS[file.mimetype];
  if (!extension) {
    throw {
      status: 400,
      code: 'INVALID_IMAGE_TYPE',
      message: 'Format gambar harus JPG, PNG, atau WebP',
    };
  }

  const path = `${userId}/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(REVIEW_IMAGE_BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    const bucketMissing = error.message?.toLowerCase().includes('bucket');
    throw {
      status: 500,
      code: bucketMissing ? 'STORAGE_NOT_READY' : 'UPLOAD_FAILED',
      message: bucketMissing
        ? 'Storage foto ulasan belum aktif. Jalankan backend/database/migrations/012_rating_photos.sql di Supabase SQL Editor.'
        : `Gagal mengunggah foto: ${error.message}`,
    };
  }

  const { data } = supabase.storage.from(REVIEW_IMAGE_BUCKET).getPublicUrl(path);
  return { image_url: data.publicUrl, path };
};

/**
 * Submit rating untuk produk setelah order delivered.
 * Satu order hanya bisa rating satu kali per produk.
 */
const submitRating = async (buyerId, payload) => {
  const { order_id, product_id, rating, comment, image_urls } = payload;

  if (!order_id || !product_id || !rating) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'order_id, product_id, dan rating wajib diisi' };
  }
  if (rating < 1 || rating > 5) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Rating harus antara 1 dan 5' };
  }

  // Validasi image_urls
  const sanitizedImages = Array.isArray(image_urls)
    ? image_urls.slice(0, MAX_PHOTOS_PER_PRODUCT).filter((url) => typeof url === 'string' && url.startsWith('http'))
    : [];

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

  // Insert rating (image_urls kolom belum ada sebelum migration 012 dijalankan)
  const { data, error } = await supabase
    .from('ratings')
    .insert([{
      order_id,
      product_id,
      buyer_id: buyerId,
      rating,
      comment: comment?.trim() || null,
      // image_urls: sanitizedImages, // TODO: uncomment setelah migration 012
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
    .select('id, rating, comment, created_at, buyer_id')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  const list = ratings || [];

  // Fetch buyer names
  const buyerIds = [...new Set(list.map(r => r.buyer_id))].filter(Boolean);
  let buyerMap = {};
  if (buyerIds.length > 0) {
    const { data: buyers } = await supabase
      .from('users')
      .select('id, name')
      .in('id', buyerIds);
    buyerMap = Object.fromEntries((buyers || []).map(b => [b.id, b.name]));
  }

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
      image_urls: [], // TODO: ubah ke r.image_urls setelah migration 012 dijalankan
      date: r.created_at,
      buyer_name: buyerMap[r.buyer_id] ?? 'Pembeli',
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

module.exports = { uploadReviewImage, submitRating, getProductRatings, checkRated };
