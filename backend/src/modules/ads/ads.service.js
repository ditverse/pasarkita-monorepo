const pool = require('../../config/mysql');
const { sendPaymentRequest } = require('../../integrations/smartbank');
const { writeAuditLog } = require('../../utils/observability');

const getHomeCarousel = async () => {
  const now = new Date().toISOString();

  const [banners] = await pool.query(
    "SELECT id, title, subtitle, image_url, target_url, placement, sort_order FROM marketplace_banners WHERE is_active = 1 AND start_time <= ? AND end_time > ? ORDER BY sort_order ASC, created_at DESC",
    [now, now]
  );

  const [productAds] = await pool.query(
    `SELECT pa.id, pa.title, pa.caption, pa.placement,
            p.id AS p_id, p.name AS p_name, p.price AS p_price, p.image_url AS p_image,
            u.name AS seller_name
     FROM product_ads pa
     INNER JOIN products p ON p.id = pa.product_id
     INNER JOIN users u ON u.id = pa.seller_id
     WHERE pa.status = 'active' AND pa.payment_status = 'paid'
       AND pa.start_date <= ? AND pa.end_date > ? AND p.is_active = 1 AND p.stock > 0
     ORDER BY pa.created_at DESC`,
    [now, now]
  );

  const formattedBanners = (banners || []).map(b => ({ kind: 'banner', id: b.id, title: b.title, subtitle: b.subtitle, image_url: b.image_url, target_url: b.target_url || '' }));
  const formattedAds = (productAds || []).map(ad => ({
    kind: 'product_ad', id: ad.id, title: ad.title || 'Sponsor', caption: ad.caption || ad.p_name,
    image_url: ad.p_image || '', target_url: `/products/${ad.p_id}`,
    product: { id: ad.p_id, name: ad.p_name, price: ad.p_price, shop_name: ad.seller_name || 'Toko PasarKita' },
  }));

  return [...formattedBanners, ...formattedAds];
};

const recordView = async (id) => {
  const [banner] = await pool.query('SELECT id FROM marketplace_banners WHERE id = ?', [id]);
  if (banner.length > 0) {
    await pool.query('CALL sp_increment_banner_views(?)', [id]).catch(async () => {
      const [a] = await pool.query('SELECT id, views_count FROM banner_analytics WHERE banner_id = ?', [id]);
      if (a[0]) await pool.query('UPDATE banner_analytics SET views_count = views_count + 1, last_recorded_at = NOW() WHERE id = ?', [a[0].id]);
      else await pool.query('INSERT INTO banner_analytics (id, banner_id, views_count, clicks_count, last_recorded_at) VALUES (UUID(), ?, 1, 0, NOW())', [id]);
    });
    return { success: true };
  }

  const [ad] = await pool.query('SELECT id FROM product_ads WHERE id = ?', [id]);
  if (ad.length > 0) {
    await pool.query('CALL sp_increment_ad_views(?)', [id]).catch(async () => {
      const [a] = await pool.query('SELECT id, views_count FROM ad_analytics WHERE ad_id = ?', [id]);
      if (a[0]) await pool.query('UPDATE ad_analytics SET views_count = views_count + 1, last_recorded_at = NOW() WHERE id = ?', [a[0].id]);
      else await pool.query('INSERT INTO ad_analytics (id, ad_id, views_count, clicks_count, last_recorded_at) VALUES (UUID(), ?, 1, 0, NOW())', [id]);
    });
    return { success: true };
  }

  throw { status: 404, code: 'NOT_FOUND', message: 'Iklan atau banner tidak ditemukan' };
};

const recordClick = async (id) => {
  const [banner] = await pool.query('SELECT id FROM marketplace_banners WHERE id = ?', [id]);
  if (banner.length > 0) {
    await pool.query('CALL sp_increment_banner_clicks(?)', [id]).catch(async () => {
      const [a] = await pool.query('SELECT id, clicks_count FROM banner_analytics WHERE banner_id = ?', [id]);
      if (a[0]) await pool.query('UPDATE banner_analytics SET clicks_count = clicks_count + 1, last_recorded_at = NOW() WHERE id = ?', [a[0].id]);
      else await pool.query('INSERT INTO banner_analytics (id, banner_id, views_count, clicks_count, last_recorded_at) VALUES (UUID(), ?, 0, 1, NOW())', [id]);
    });
    return { success: true };
  }

  const [ad] = await pool.query('SELECT id FROM product_ads WHERE id = ?', [id]);
  if (ad.length > 0) {
    await pool.query('CALL sp_increment_ad_clicks(?)', [id]).catch(async () => {
      const [a] = await pool.query('SELECT id, clicks_count FROM ad_analytics WHERE ad_id = ?', [id]);
      if (a[0]) await pool.query('UPDATE ad_analytics SET clicks_count = clicks_count + 1, last_recorded_at = NOW() WHERE id = ?', [a[0].id]);
      else await pool.query('INSERT INTO ad_analytics (id, ad_id, views_count, clicks_count, last_recorded_at) VALUES (UUID(), ?, 0, 1, NOW())', [id]);
    });
    return { success: true };
  }

  throw { status: 404, code: 'NOT_FOUND', message: 'Iklan atau banner tidak ditemukan' };
};

const getSellerAds = async (sellerId) => {
  const [data] = await pool.query(
    `SELECT pa.*, p.name AS pname, p.price AS pprice, p.stock AS pstock, p.is_active AS pactive, p.image_url AS pimage
     FROM product_ads pa INNER JOIN products p ON p.id = pa.product_id
     WHERE pa.seller_id = ? ORDER BY pa.created_at DESC`, [sellerId]
  );
  const adIds = data.map(a => a.id);
  let analyticsMap = new Map();
  if (adIds.length > 0) {
    const [analytics] = await pool.query(`SELECT ad_id, views_count, clicks_count FROM ad_analytics WHERE ad_id IN (${adIds.map(() => '?').join(',')})`, adIds);
    analytics.forEach(a => analyticsMap.set(a.ad_id, { views: a.views_count, clicks: a.clicks_count }));
  }
  return data.map(a => ({ ...a, product_name: a.pname || 'Produk Terhapus', views_count: analyticsMap.get(a.id)?.views || 0, clicks_count: analyticsMap.get(a.id)?.clicks || 0 }));
};

const createSellerAd = async (sellerId, adData) => {
  const { product_id, start_date, end_date, title, caption } = adData;
  const [prodRows] = await pool.query('SELECT id, seller_id, is_active, stock FROM products WHERE id = ?', [product_id]);
  const product = prodRows[0];
  if (!product) throw { status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Produk tidak ditemukan' };
  if (product.seller_id !== sellerId) throw { status: 403, code: 'FORBIDDEN', message: 'Anda hanya dapat mengiklankan produk toko sendiri' };
  if (!product.is_active) throw { status: 400, code: 'PRODUCT_INACTIVE', message: 'Produk tidak aktif' };
  if (product.stock <= 0) throw { status: 400, code: 'OUT_OF_STOCK', message: 'Produk kehabisan stok' };

  const days = Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24));
  if (days <= 0) throw { status: 400, code: 'INVALID_DURATION', message: 'Durasi iklan minimal 1 hari' };

  const pricePerDay = 5000; const totalPrice = days * pricePerDay;
  const id = require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO product_ads (id, product_id, seller_id, start_date, end_date, price_per_day, total_price, status, payment_status, title, caption, placement)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'unpaid', ?, ?, 'home_carousel')`,
    [id, product_id, sellerId, start_date, end_date, pricePerDay, totalPrice, title || null, caption || null]
  );
  const [rows] = await pool.query('SELECT * FROM product_ads WHERE id = ?', [id]);
  return rows[0];
};

const paySellerAd = async (sellerId, adId) => {
  const [adRows] = await pool.query('SELECT * FROM product_ads WHERE id = ? AND seller_id = ?', [adId, sellerId]);
  const ad = adRows[0];
  if (!ad) throw { status: 404, code: 'AD_NOT_FOUND', message: 'Iklan tidak ditemukan' };
  if (ad.payment_status === 'paid') throw { status: 400, code: 'ALREADY_PAID', message: 'Iklan sudah dibayar' };

  const paymentResult = await sendPaymentRequest({ orderId: ad.id, fromUser: sellerId, amount: ad.total_price, feeMarketplace: 0, items: [{ name: `Iklan Produk PasarKita - ID ${ad.id}`, qty: 1, price: ad.total_price }] });
  if (!paymentResult || !paymentResult.success) throw { status: 402, code: 'PAYMENT_FAILED', message: 'Pembayaran iklan gagal' };

  const now = new Date();
  let status = 'scheduled';
  if (now >= new Date(ad.start_date) && now <= new Date(ad.end_date)) status = 'active';
  else if (now > new Date(ad.end_date)) status = 'completed';

  await pool.query(
    "UPDATE product_ads SET payment_status = 'paid', transaction_id = ?, status = ?, updated_at = NOW() WHERE id = ?",
    [paymentResult.data?.transaction_id || 'TXN-ADS-MOCK', status, adId]
  );
  const [rows] = await pool.query('SELECT * FROM product_ads WHERE id = ?', [adId]);
  return rows[0];
};

const pauseSellerAd = async (sellerId, adId) => {
  const [adRows] = await pool.query('SELECT id, status FROM product_ads WHERE id = ? AND seller_id = ?', [adId, sellerId]);
  const ad = adRows[0];
  if (!ad) throw { status: 404, code: 'AD_NOT_FOUND', message: 'Iklan tidak ditemukan' };
  if (ad.status !== 'active' && ad.status !== 'scheduled') throw { status: 400, code: 'INVALID_STATUS', message: 'Hanya iklan aktif/terjadwal yang dapat dijeda' };
  await pool.query("UPDATE product_ads SET status = 'paused', paused_reason = 'Dijeda oleh penjual' WHERE id = ?", [adId]);
  const [rows] = await pool.query('SELECT * FROM product_ads WHERE id = ?', [adId]);
  return rows[0];
};

const getAdminAds = async () => {
  const [data] = await pool.query(
    `SELECT pa.*, p.name AS pname, u.name AS sname, u.email AS semail
     FROM product_ads pa
     INNER JOIN products p ON p.id = pa.product_id
     INNER JOIN users u ON u.id = pa.seller_id
     ORDER BY pa.created_at DESC`
  );
  const adIds = data.map(a => a.id);
  let analyticsMap = new Map();
  if (adIds.length > 0) {
    const [analytics] = await pool.query(`SELECT ad_id, views_count, clicks_count FROM ad_analytics WHERE ad_id IN (${adIds.map(() => '?').join(',')})`, adIds);
    analytics.forEach(a => analyticsMap.set(a.ad_id, { views: a.views_count, clicks: a.clicks_count }));
  }
  return data.map(a => ({ ...a, product_name: a.pname || 'Produk Terhapus', seller_name: a.sname || 'Penjual Tidak Dikenal', seller_email: a.semail || '', views_count: analyticsMap.get(a.id)?.views || 0, clicks_count: analyticsMap.get(a.id)?.clicks || 0 }));
};

const moderateSellerAd = async (adminId, adId, status, reason) => {
  const [adRows] = await pool.query('SELECT * FROM product_ads WHERE id = ?', [adId]);
  const ad = adRows[0];
  if (!ad) throw { status: 404, code: 'AD_NOT_FOUND', message: 'Iklan tidak ditemukan' };

  const updateFields = { status, reviewed_by: adminId, reviewed_at: new Date().toISOString() };
  if (status === 'rejected') updateFields.rejection_reason = reason || 'Ditolak oleh admin';
  else if (status === 'paused') updateFields.paused_reason = reason || 'Dijeda oleh admin';
  else if (status === 'active') { updateFields.rejection_reason = null; updateFields.paused_reason = null; }

  const fields = []; const values = [];
  for (const [k, v] of Object.entries(updateFields)) { fields.push(`${k} = ?`); values.push(v); }
  values.push(adId);
  await pool.query(`UPDATE product_ads SET ${fields.join(', ')} WHERE id = ?`, values);

  await writeAuditLog({ actorId: adminId, action: `ad.moderate.${status}`, targetType: 'product_ads', targetId: adId, reason: reason || `Iklan diubah status menjadi ${status}`, before: { status: ad.status }, after: { status } });

  const [rows] = await pool.query('SELECT * FROM product_ads WHERE id = ?', [adId]);
  return rows[0];
};

const getBanners = async () => {
  const [data] = await pool.query('SELECT * FROM marketplace_banners ORDER BY sort_order ASC, created_at DESC');
  const bannerIds = data.map(b => b.id);
  let analyticsMap = new Map();
  if (bannerIds.length > 0) {
    const [analytics] = await pool.query(`SELECT banner_id, views_count, clicks_count FROM banner_analytics WHERE banner_id IN (${bannerIds.map(() => '?').join(',')})`, bannerIds);
    analytics.forEach(a => analyticsMap.set(a.banner_id, { views: a.views_count, clicks: a.clicks_count }));
  }
  return data.map(b => ({ ...b, views_count: analyticsMap.get(b.id)?.views || 0, clicks_count: analyticsMap.get(b.id)?.clicks || 0 }));
};

const createBanner = async (adminId, bannerData) => {
  const id = require('crypto').randomUUID();
  await pool.query(
    'INSERT INTO marketplace_banners (id, title, subtitle, image_url, target_url, placement, start_time, end_time, sort_order, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, bannerData.title, bannerData.subtitle || null, bannerData.image_url, bannerData.target_url || null, bannerData.placement || 'home_carousel', bannerData.start_time, bannerData.end_time, bannerData.sort_order || 0, bannerData.is_active !== undefined ? (bannerData.is_active ? 1 : 0) : 1, adminId]
  );
  await writeAuditLog({ actorId: adminId, action: 'banner.create', targetType: 'marketplace_banners', targetId: id, after: bannerData });
  const [rows] = await pool.query('SELECT * FROM marketplace_banners WHERE id = ?', [id]);
  return rows[0];
};

const updateBanner = async (adminId, bannerId, bannerData) => {
  const [existing] = await pool.query('SELECT * FROM marketplace_banners WHERE id = ?', [bannerId]);
  if (!existing[0]) throw { status: 404, code: 'BANNER_NOT_FOUND', message: 'Banner tidak ditemukan' };

  const fields = []; const values = [];
  for (const [k, v] of Object.entries(bannerData)) {
    if (['title', 'subtitle', 'image_url', 'target_url', 'placement', 'start_time', 'end_time', 'sort_order', 'is_active'].includes(k)) {
      fields.push(`${k} = ?`); values.push(k === 'is_active' ? (v ? 1 : 0) : v);
    }
  }
  if (fields.length > 0) { values.push(bannerId); await pool.query(`UPDATE marketplace_banners SET ${fields.join(', ')} WHERE id = ?`, values); }

  await writeAuditLog({ actorId: adminId, action: 'banner.update', targetType: 'marketplace_banners', targetId: bannerId, before: existing[0], after: bannerData });
  const [rows] = await pool.query('SELECT * FROM marketplace_banners WHERE id = ?', [bannerId]);
  return rows[0];
};

const deleteBanner = async (adminId, bannerId) => {
  const [existing] = await pool.query('SELECT * FROM marketplace_banners WHERE id = ?', [bannerId]);
  if (!existing[0]) throw { status: 404, code: 'BANNER_NOT_FOUND', message: 'Banner tidak ditemukan' };
  await pool.query('DELETE FROM marketplace_banners WHERE id = ?', [bannerId]);
  await writeAuditLog({ actorId: adminId, action: 'banner.delete', targetType: 'marketplace_banners', targetId: bannerId, before: existing[0] });
  return { success: true };
};

module.exports = {
  getHomeCarousel, recordView, recordClick, getSellerAds, createSellerAd, paySellerAd,
  pauseSellerAd, getAdminAds, moderateSellerAd, getBanners, createBanner, updateBanner, deleteBanner,
};
