const supabase = require('../../config/supabase');

const getNotifications = async (userId, query = {}) => {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 50);
  const { data, error } = await supabase
    .from('notifications')
    .select('id, order_id, type, title, message, href, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  return data || [];
};

const markRead = async (userId, notificationId) => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('id, read_at')
    .maybeSingle();

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }
  if (!data) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Notifikasi tidak ditemukan' };
  }
  return data;
};

const markAllRead = async (userId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }
  return { changed: true };
};

/**
 * Buat satu notifikasi (internal helper — tidak melempar error ke caller).
 */
const createNotification = async ({ userId, type, title, message, href = null, orderId = null }) => {
  try {
    await supabase.from('notifications').insert([{
      user_id: userId,
      type,
      title,
      message,
      href,
      order_id: orderId,
    }]);
  } catch (err) {
    console.error('[Notification] Gagal membuat notifikasi:', err?.message ?? err);
  }
};

/**
 * Kirim notifikasi "order masuk" ke setiap seller yang produknya ada di order tersebut.
 * Dipanggil setelah order berhasil dibayar (status → paid).
 * Fire-and-forget: error tidak melempar exception.
 */
const notifySellerNewOrder = async (orderId, orderItems) => {
  try {
    if (!Array.isArray(orderItems) || orderItems.length === 0) return;

    // Ambil seller_id dari setiap product
    const productIds = [...new Set(orderItems.map((i) => i.product_id))];
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, seller_id')
      .in('id', productIds);

    if (error || !products?.length) return;

    // Kelompokkan per seller
    const sellerMap = new Map();
    for (const item of orderItems) {
      const product = products.find((p) => p.id === item.product_id);
      if (!product?.seller_id) continue;
      if (!sellerMap.has(product.seller_id)) {
        sellerMap.set(product.seller_id, []);
      }
      sellerMap.get(product.seller_id).push(product.name);
    }

    // Kirim notif ke setiap seller
    const notifs = [];
    for (const [sellerId, productNames] of sellerMap.entries()) {
      const productLabel = productNames.length === 1
        ? `"${productNames[0]}"`
        : `${productNames.length} produk`;
      notifs.push({
        user_id: sellerId,
        type: 'order',
        title: 'Pesanan Baru Masuk!',
        message: `Ada pesanan baru untuk ${productLabel}. Segera proses.`,
        href: `/seller/orders/${orderId}`,
        order_id: orderId,
      });
    }

    if (notifs.length > 0) {
      await supabase.from('notifications').insert(notifs);
    }
  } catch (err) {
    console.error('[Notification] notifySellerNewOrder error:', err?.message ?? err);
  }
};

/**
 * Kirim notifikasi "stok menipis/habis" ke seller setelah stok berkurang.
 * Hanya kirim jika stok di bawah minimum_stock atau habis.
 * Deduplikasi: tidak kirim ulang jika sudah ada notif stok yang belum dibaca di 24 jam terakhir.
 * Fire-and-forget: error tidak melempar exception.
 */
const notifySellerLowStock = async (productId, productName, sellerId, newStock, minimumStock) => {
  try {
    const isOut = newStock <= 0;
    const isLow = !isOut && newStock <= minimumStock;
    if (!isOut && !isLow) return;

    // Deduplikasi: cek notifikasi stok dalam 24 jam terakhir untuk produk ini
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifs } = await supabase
      .from('notifications')
      .select('id, message')
      .eq('user_id', sellerId)
      .eq('type', 'system')
      .gte('created_at', since)
      .limit(50); // Ambil secukupnya untuk deduplikasi memory
      
    const { kmpSearch } = require('../../utils/kmp-search');
    const hasRecent = (recentNotifs || []).some(n => kmpSearch(n.message || '', productId));

    if (hasRecent) return; // Sudah ada notif stok dalam 24 jam

    const title = isOut ? 'Stok Produk Habis!' : 'Stok Produk Menipis';
    const message = isOut
      ? `"${productName}" kehabisan stok. Segera perbarui stok agar produk tetap aktif.`
      : `"${productName}" tersisa ${newStock} unit (batas minimum: ${minimumStock}). Pertimbangkan restock.`;

    await createNotification({
      userId: sellerId,
      type: 'system',
      title,
      message: `${message} [id:${productId}]`, // sertakan id untuk deduplikasi
      href: `/seller/products/edit/${productId}`,
    });
  } catch (err) {
    console.error('[Notification] notifySellerLowStock error:', err?.message ?? err);
  }
};

const notifyComplaintCreated = async (sellerId, orderId) => {
  await createNotification({
    userId: sellerId,
    type: 'COMPLAINT_NEW',
    title: 'Komplain Baru',
    message: 'Pembeli mengajukan komplain untuk pesanan ini. Harap segera berikan tanggapan.',
    href: '/seller/complaints',
    orderId,
  });
};

const notifyComplaintReplied = async (buyerId, orderId) => {
  await createNotification({
    userId: buyerId,
    type: 'COMPLAINT_REPLIED',
    title: 'Tanggapan Komplain',
    message: 'Penjual telah merespons komplain Anda. Harap cek pusat resolusi.',
    href: `/orders/${orderId}`,
    orderId,
  });
};

const notifyComplaintResolved = async (userId, orderId, isSeller = false) => {
  await createNotification({
    userId,
    type: 'COMPLAINT_RESOLVED',
    title: 'Komplain Selesai',
    message: 'Sengketa telah diselesaikan atau ditutup. Cek detail pesanan.',
    href: isSeller ? `/seller/orders/${orderId}` : `/orders/${orderId}`,
    orderId,
  });
};

module.exports = { 
  getNotifications, 
  markRead, 
  markAllRead, 
  createNotification,
  notifySellerNewOrder, 
  notifySellerLowStock,
  notifyComplaintCreated,
  notifyComplaintReplied,
  notifyComplaintResolved
};
