const supabase = require('../../config/supabase');
const { sendPaymentRequest } = require('../../integrations/smartbank');
const { writeAuditLog } = require('../../utils/observability');

/**
 * Get active banners and product ads for home carousel
 */
const getHomeCarousel = async () => {
  const now = new Date().toISOString();

  // 1. Get active banners
  const { data: banners, error: bannersError } = await supabase
    .from('marketplace_banners')
    .select('id, title, subtitle, image_url, target_url, placement, sort_order')
    .eq('is_active', true)
    .lte('start_time', now)
    .gt('end_time', now)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (bannersError) {
    throw { status: 500, code: 'DATABASE_ERROR', message: bannersError.message };
  }

  // 2. Get active, paid product ads
  // Note: since we need products and users info, we join them.
  const { data: productAds, error: adsError } = await supabase
    .from('product_ads')
    .select(`
      id, title, caption, placement, start_date, end_date,
      products!inner (
        id, name, price, is_active, stock, image_url,
        users!inner ( id, name )
      )
    `)
    .eq('status', 'active')
    .eq('payment_status', 'paid')
    .lte('start_date', now)
    .gt('end_date', now)
    .eq('products.is_active', true)
    .gt('products.stock', 0)
    .order('created_at', { ascending: false });

  if (adsError) {
    throw { status: 500, code: 'DATABASE_ERROR', message: adsError.message };
  }

  // 3. Format and merge
  const formattedBanners = (banners || []).map(b => ({
    kind: 'banner',
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    image_url: b.image_url,
    target_url: b.target_url || '',
  }));

  const formattedAds = (productAds || []).map(ad => ({
    kind: 'product_ad',
    id: ad.id,
    title: ad.title || 'Sponsor',
    caption: ad.caption || ad.products.name,
    image_url: ad.products.image_url || '',
    target_url: `/products/${ad.products.id}`,
    product: {
      id: ad.products.id,
      name: ad.products.name,
      price: ad.products.price,
      shop_name: ad.products.users?.name || 'Toko PasarKita',
    }
  }));

  return [...formattedBanners, ...formattedAds];
};

/**
 * Record view for an ad or banner
 */
const recordView = async (id) => {
  // Check if id is a banner first
  const { data: banner } = await supabase
    .from('marketplace_banners')
    .select('id')
    .eq('id', id)
    .single();

  if (banner) {
    // Record view in banner_analytics
    const { error } = await supabase.rpc('increment_banner_views', { p_banner_id: id });
    if (error) {
      // Fallback if RPC doesn't exist
      const { data: analytics } = await supabase
        .from('banner_analytics')
        .select('id, views_count')
        .eq('banner_id', id)
        .maybeSingle();

      if (analytics) {
        await supabase
          .from('banner_analytics')
          .update({ views_count: (analytics.views_count || 0) + 1, last_recorded_at: new Date().toISOString() })
          .eq('id', analytics.id);
      } else {
        await supabase
          .from('banner_analytics')
          .insert([{ banner_id: id, views_count: 1, last_recorded_at: new Date().toISOString() }]);
      }
    }
    return { success: true };
  }

  // Check if id is a product ad
  const { data: ad } = await supabase
    .from('product_ads')
    .select('id')
    .eq('id', id)
    .single();

  if (ad) {
    // Record view in ad_analytics
    const { error } = await supabase.rpc('increment_ad_views', { p_ad_id: id });
    if (error) {
      const { data: analytics } = await supabase
        .from('ad_analytics')
        .select('id, views_count')
        .eq('ad_id', id)
        .maybeSingle();

      if (analytics) {
        await supabase
          .from('ad_analytics')
          .update({ views_count: (analytics.views_count || 0) + 1, last_recorded_at: new Date().toISOString() })
          .eq('id', analytics.id);
      } else {
        await supabase
          .from('ad_analytics')
          .insert([{ ad_id: id, views_count: 1, last_recorded_at: new Date().toISOString() }]);
      }
    }
    return { success: true };
  }

  throw { status: 404, code: 'NOT_FOUND', message: 'Iklan atau banner tidak ditemukan' };
};

/**
 * Record click for an ad or banner
 */
const recordClick = async (id) => {
  // Check if id is a banner first
  const { data: banner } = await supabase
    .from('marketplace_banners')
    .select('id')
    .eq('id', id)
    .single();

  if (banner) {
    // Record click in banner_analytics
    const { error } = await supabase.rpc('increment_banner_clicks', { p_banner_id: id });
    if (error) {
      const { data: analytics } = await supabase
        .from('banner_analytics')
        .select('id, clicks_count')
        .eq('banner_id', id)
        .maybeSingle();

      if (analytics) {
        await supabase
          .from('banner_analytics')
          .update({ clicks_count: (analytics.clicks_count || 0) + 1, last_recorded_at: new Date().toISOString() })
          .eq('id', analytics.id);
      } else {
        await supabase
          .from('banner_analytics')
          .insert([{ banner_id: id, clicks_count: 1, last_recorded_at: new Date().toISOString() }]);
      }
    }
    return { success: true };
  }

  // Check if id is a product ad
  const { data: ad } = await supabase
    .from('product_ads')
    .select('id')
    .eq('id', id)
    .single();

  if (ad) {
    // Record click in ad_analytics
    const { error } = await supabase.rpc('increment_ad_clicks', { p_ad_id: id });
    if (error) {
      const { data: analytics } = await supabase
        .from('ad_analytics')
        .select('id, clicks_count')
        .eq('ad_id', id)
        .maybeSingle();

      if (analytics) {
        await supabase
          .from('ad_analytics')
          .update({ clicks_count: (analytics.clicks_count || 0) + 1, last_recorded_at: new Date().toISOString() })
          .eq('id', analytics.id);
      } else {
        await supabase
          .from('ad_analytics')
          .insert([{ ad_id: id, clicks_count: 1, last_recorded_at: new Date().toISOString() }]);
      }
    }
    return { success: true };
  }

  throw { status: 404, code: 'NOT_FOUND', message: 'Iklan atau banner tidak ditemukan' };
};

/**
 * Get seller ads with product info
 */
const getSellerAds = async (sellerId) => {
  const { data, error } = await supabase
    .from('product_ads')
    .select(`
      *,
      products ( id, name, price, stock, is_active, image_url )
    `)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw { status: 500, code: 'DATABASE_ERROR', message: error.message };
  }

  // Fetch view/click count if they exist
  const adIds = (data || []).map(ad => ad.id);
  let analyticsMap = new Map();
  if (adIds.length > 0) {
    const { data: analytics } = await supabase
      .from('ad_analytics')
      .select('ad_id, views_count, clicks_count')
      .in('ad_id', adIds);
    (analytics || []).forEach(a => {
      analyticsMap.set(a.ad_id, { views: a.views_count, clicks: a.clicks_count });
    });
  }

  return (data || []).map(ad => ({
    ...ad,
    product_name: ad.products?.name || 'Produk Terhapus',
    views_count: analyticsMap.get(ad.id)?.views || 0,
    clicks_count: analyticsMap.get(ad.id)?.clicks || 0,
  }));
};

/**
 * Create seller ad booking
 */
const createSellerAd = async (sellerId, adData) => {
  const { product_id, start_date, end_date, title, caption } = adData;

  // 1. Verify product ownership and stock
  const { data: product, error: prodError } = await supabase
    .from('products')
    .select('id, seller_id, is_active, stock')
    .eq('id', product_id)
    .single();

  if (prodError || !product) {
    throw { status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Produk tidak ditemukan' };
  }

  if (product.seller_id !== sellerId) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Anda hanya dapat mengiklankan produk toko sendiri' };
  }

  if (!product.is_active) {
    throw { status: 400, code: 'PRODUCT_INACTIVE', message: 'Produk tidak aktif' };
  }

  if (product.stock <= 0) {
    throw { status: 400, code: 'OUT_OF_STOCK', message: 'Produk kehabisan stok' };
  }

  // 2. Calculate price
  const days = Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24));
  if (days <= 0) {
    throw { status: 400, code: 'INVALID_DURATION', message: 'Durasi iklan minimal 1 hari' };
  }

  const pricePerDay = 5000;
  const totalPrice = days * pricePerDay;

  // 3. Insert ad
  const { data, error } = await supabase
    .from('product_ads')
    .insert([{
      product_id,
      seller_id: sellerId,
      start_date,
      end_date,
      price_per_day: pricePerDay,
      total_price: totalPrice,
      status: 'pending_payment',
      payment_status: 'unpaid',
      title,
      caption,
      placement: 'home_carousel',
    }])
    .select()
    .single();

  if (error) {
    throw { status: 500, code: 'DATABASE_ERROR', message: error.message };
  }

  return data;
};

/**
 * Pay for seller ad booking
 */
const paySellerAd = async (sellerId, adId) => {
  // 1. Find ad
  const { data: ad, error: adError } = await supabase
    .from('product_ads')
    .select('*')
    .eq('id', adId)
    .eq('seller_id', sellerId)
    .single();

  if (adError || !ad) {
    throw { status: 404, code: 'AD_NOT_FOUND', message: 'Iklan tidak ditemukan' };
  }

  if (ad.payment_status === 'paid') {
    throw { status: 400, code: 'ALREADY_PAID', message: 'Iklan sudah dibayar' };
  }

  // 2. Trigger SmartBank payment
  const paymentResult = await sendPaymentRequest({
    orderId: ad.id,
    fromUser: sellerId,
    amount: ad.total_price,
    feeMarketplace: 0,
    items: [{ name: `Iklan Produk PasarKita - ID ${ad.id}`, qty: 1, price: ad.total_price }],
  });

  if (!paymentResult || !paymentResult.success) {
    throw { status: 402, code: 'PAYMENT_FAILED', message: 'Pembayaran iklan gagal' };
  }

  // 3. Update status
  const now = new Date();
  let status = 'scheduled';
  if (now >= new Date(ad.start_date) && now <= new Date(ad.end_date)) {
    status = 'active';
  } else if (now > new Date(ad.end_date)) {
    status = 'completed';
  }

  const { data, error } = await supabase
    .from('product_ads')
    .update({
      payment_status: 'paid',
      transaction_id: paymentResult.data?.transaction_id || 'TXN-ADS-MOCK',
      status,
      updated_at: now.toISOString(),
    })
    .eq('id', adId)
    .select()
    .single();

  if (error) {
    throw { status: 500, code: 'DATABASE_ERROR', message: error.message };
  }

  return data;
};

/**
 * Pause seller ad
 */
const pauseSellerAd = async (sellerId, adId) => {
  const { data: ad, error: adError } = await supabase
    .from('product_ads')
    .select('id, status')
    .eq('id', adId)
    .eq('seller_id', sellerId)
    .single();

  if (adError || !ad) {
    throw { status: 404, code: 'AD_NOT_FOUND', message: 'Iklan tidak ditemukan' };
  }

  if (ad.status !== 'active' && ad.status !== 'scheduled') {
    throw { status: 400, code: 'INVALID_STATUS', message: 'Hanya iklan berstatus aktif atau terjadwal yang dapat dijeda' };
  }

  const { data, error } = await supabase
    .from('product_ads')
    .update({ status: 'paused', paused_reason: 'Dijeda oleh penjual' })
    .eq('id', adId)
    .select()
    .single();

  if (error) {
    throw { status: 500, code: 'DATABASE_ERROR', message: error.message };
  }

  return data;
};

/**
 * Get all product ads for admin
 */
const getAdminAds = async () => {
  const { data, error } = await supabase
    .from('product_ads')
    .select(`
      *,
      products ( id, name, price, stock, is_active, image_url ),
      users ( id, name, email )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw { status: 500, code: 'DATABASE_ERROR', message: error.message };
  }

  // Fetch view/click count if they exist
  const adIds = (data || []).map(ad => ad.id);
  let analyticsMap = new Map();
  if (adIds.length > 0) {
    const { data: analytics } = await supabase
      .from('ad_analytics')
      .select('ad_id, views_count, clicks_count')
      .in('ad_id', adIds);
    (analytics || []).forEach(a => {
      analyticsMap.set(a.ad_id, { views: a.views_count, clicks: a.clicks_count });
    });
  }

  return (data || []).map(ad => ({
    ...ad,
    product_name: ad.products?.name || 'Produk Terhapus',
    seller_name: ad.users?.name || 'Penjual Tidak Dikenal',
    seller_email: ad.users?.email || '',
    views_count: analyticsMap.get(ad.id)?.views || 0,
    clicks_count: analyticsMap.get(ad.id)?.clicks || 0,
  }));
};

/**
 * Moderate seller ad
 */
const moderateSellerAd = async (adminId, adId, status, reason) => {
  const { data: ad, error: adError } = await supabase
    .from('product_ads')
    .select('*')
    .eq('id', adId)
    .single();

  if (adError || !ad) {
    throw { status: 404, code: 'AD_NOT_FOUND', message: 'Iklan tidak ditemukan' };
  }

  const beforeData = { status: ad.status, rejection_reason: ad.rejection_reason, paused_reason: ad.paused_reason };
  const updatePayload = {
    status,
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (status === 'rejected') {
    updatePayload.rejection_reason = reason || 'Ditolak oleh admin';
  } else if (status === 'paused') {
    updatePayload.paused_reason = reason || 'Dijeda oleh admin';
  } else if (status === 'active') {
    // Clear reasons on activation
    updatePayload.rejection_reason = null;
    updatePayload.paused_reason = null;
  }

  const { data, error } = await supabase
    .from('product_ads')
    .update(updatePayload)
    .eq('id', adId)
    .select()
    .single();

  if (error) {
    throw { status: 500, code: 'DATABASE_ERROR', message: error.message };
  }

  // Log to audit log
  await writeAuditLog({
    actorId: adminId,
    action: `ad.moderate.${status}`,
    targetType: 'product_ads',
    targetId: adId,
    reason: reason || `Iklan diubah status menjadi ${status}`,
    before: beforeData,
    after: { status, rejection_reason: updatePayload.rejection_reason, paused_reason: updatePayload.paused_reason },
  });

  return data;
};

/**
 * Get all marketplace banners with views and clicks
 */
const getBanners = async () => {
  const { data, error } = await supabase
    .from('marketplace_banners')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    throw { status: 500, code: 'DATABASE_ERROR', message: error.message };
  }

  // Fetch view/click count if they exist
  const bannerIds = (data || []).map(b => b.id);
  let analyticsMap = new Map();
  if (bannerIds.length > 0) {
    const { data: analytics } = await supabase
      .from('banner_analytics')
      .select('banner_id, views_count, clicks_count')
      .in('banner_id', bannerIds);
    (analytics || []).forEach(a => {
      analyticsMap.set(a.banner_id, { views: a.views_count, clicks: a.clicks_count });
    });
  }

  return (data || []).map(b => ({
    ...b,
    views_count: analyticsMap.get(b.id)?.views || 0,
    clicks_count: analyticsMap.get(b.id)?.clicks || 0,
  }));
};

/**
 * Create a banner
 */
const createBanner = async (adminId, bannerData) => {
  const { data, error } = await supabase
    .from('marketplace_banners')
    .insert([{
      ...bannerData,
      created_by: adminId,
    }])
    .select()
    .single();

  if (error) {
    throw { status: 500, code: 'DATABASE_ERROR', message: error.message };
  }

  await writeAuditLog({
    actorId: adminId,
    action: 'banner.create',
    targetType: 'marketplace_banners',
    targetId: data.id,
    after: data,
  });

  return data;
};

/**
 * Update a banner
 */
const updateBanner = async (adminId, bannerId, bannerData) => {
  const { data: existing, error: getError } = await supabase
    .from('marketplace_banners')
    .select('*')
    .eq('id', bannerId)
    .single();

  if (getError || !existing) {
    throw { status: 404, code: 'BANNER_NOT_FOUND', message: 'Banner tidak ditemukan' };
  }

  const { data, error } = await supabase
    .from('marketplace_banners')
    .update({
      ...bannerData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bannerId)
    .select()
    .single();

  if (error) {
    throw { status: 500, code: 'DATABASE_ERROR', message: error.message };
  }

  await writeAuditLog({
    actorId: adminId,
    action: 'banner.update',
    targetType: 'marketplace_banners',
    targetId: bannerId,
    before: existing,
    after: data,
  });

  return data;
};

/**
 * Delete a banner
 */
const deleteBanner = async (adminId, bannerId) => {
  const { data: existing, error: getError } = await supabase
    .from('marketplace_banners')
    .select('*')
    .eq('id', bannerId)
    .single();

  if (getError || !existing) {
    throw { status: 404, code: 'BANNER_NOT_FOUND', message: 'Banner tidak ditemukan' };
  }

  const { error } = await supabase
    .from('marketplace_banners')
    .delete()
    .eq('id', bannerId);

  if (error) {
    throw { status: 500, code: 'DATABASE_ERROR', message: error.message };
  }

  await writeAuditLog({
    actorId: adminId,
    action: 'banner.delete',
    targetType: 'marketplace_banners',
    targetId: bannerId,
    before: existing,
  });

  return { success: true };
};

module.exports = {
  getHomeCarousel,
  recordView,
  recordClick,
  getSellerAds,
  createSellerAd,
  paySellerAd,
  pauseSellerAd,
  getAdminAds,
  moderateSellerAd,
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
};
