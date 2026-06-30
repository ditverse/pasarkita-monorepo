const supabase = require('../../config/supabase');
const { calculateFee } = require('../../utils/fee');

const PROMOTION_TABLE_MISSING_CODES = new Set(['42P01', '42703', 'PGRST200', 'PGRST204']);

const normalizeCode = (code) => (code || '').trim().toUpperCase();
const uniqueCodes = (codes = []) => [...new Set(codes.map(normalizeCode).filter(Boolean))];

const isPromotionSchemaError = (error) =>
  PROMOTION_TABLE_MISSING_CODES.has(error?.code) ||
  /product_discounts|vouchers|order_vouchers|user_vouchers/i.test(error?.message || '');

const calculateDiscountAmount = (type, value, base, maxDiscount = null) => {
  const raw = type === 'percentage'
    ? Math.round(base * (Number(value) || 0) / 100)
    : Number(value) || 0;
  const capped = maxDiscount ? Math.min(raw, Number(maxDiscount)) : raw;
  return Math.max(0, Math.min(capped, base));
};

const getDiscountPerUnit = (discount, price) => {
  if (!discount) return 0;
  const raw = discount.discount_type === 'percentage'
    ? Math.round(price * discount.discount_value / 100)
    : discount.discount_value;
  return Math.max(0, Math.min(raw, Math.max(price - 1, 0)));
};

const getActiveDiscounts = async (productIds) => {
  if (!productIds.length) return [];
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('product_discounts')
    .select('*')
    .in('product_id', productIds)
    .eq('is_active', true)
    .lte('start_time', now)
    .gt('end_time', now);

  if (error) {
    if (isPromotionSchemaError(error)) return [];
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }
  return data || [];
};

const chooseBestDiscounts = (discounts, productsById) => {
  const best = new Map();
  for (const discount of discounts) {
    const product = productsById.get(discount.product_id);
    if (!product) continue;
    const amount = getDiscountPerUnit(discount, Number(product.price || 0));
    const current = best.get(discount.product_id);
    if (!current || amount > current.amount) {
      best.set(discount.product_id, { discount, amount });
    }
  }
  return best;
};

const enrichProductsWithPromotions = async (products) => {
  const list = Array.isArray(products) ? products : [products].filter(Boolean);
  if (list.length === 0) return Array.isArray(products) ? [] : products;

  const productsById = new Map(list.map((product) => [product.id, product]));
  const discounts = await getActiveDiscounts([...productsById.keys()]);
  const best = chooseBestDiscounts(discounts, productsById);

  const enriched = list.map((product) => {
    const selected = best.get(product.id);
    const originalPrice = Number(product.price || 0);
    const discountPerUnit = selected?.amount || 0;
    const effectivePrice = Math.max(originalPrice - discountPerUnit, 0);
    return {
      ...product,
      original_price: originalPrice,
      effective_price: effectivePrice,
      active_discount: selected
        ? {
            id: selected.discount.id,
            discount_type: selected.discount.discount_type,
            discount_value: selected.discount.discount_value,
            discount_per_unit: discountPerUnit,
            start_time: selected.discount.start_time,
            end_time: selected.discount.end_time,
          }
        : null,
    };
  });

  return Array.isArray(products) ? enriched : enriched[0];
};

const fetchProductsForQuote = async (items) => {
  const productIds = items.map((item) => item.product_id);
  const { data, error } = await supabase
    .from('products')
    .select('id, seller_id, name, description, category, price, stock, is_active, image_url, seller:users!seller_id(id, name)')
    .in('id', productIds);

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data || [];
};

const fetchVouchersByCodes = async (codes) => {
  const normalized = uniqueCodes(codes);
  if (normalized.length === 0) return [];
  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .in('code', normalized);

  if (error) {
    if (isPromotionSchemaError(error)) return [];
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }
  return data || [];
};

const isVoucherCurrentlyValid = (voucher, now = new Date()) =>
  voucher &&
  voucher.is_active &&
  new Date(voucher.start_time) <= now &&
  new Date(voucher.end_time) > now &&
  Number(voucher.used_count || 0) < Number(voucher.quota || 0);

const buildQuoteItems = async (items) => {
  const products = await fetchProductsForQuote(items);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const discounts = await getActiveDiscounts(items.map((item) => item.product_id));
  const bestDiscounts = chooseBestDiscounts(discounts, productsById);

  return items.map((item) => {
    const product = productsById.get(item.product_id);
    if (!product || !product.is_active) {
      throw { status: 404, code: 'NOT_FOUND', message: `Produk tidak ditemukan: ${item.product_id}` };
    }
    if (Number(product.stock || 0) < item.qty) {
      throw {
        status: 400,
        code: 'INSUFFICIENT_STOCK',
        message: 'Stok tidak mencukupi',
        details: `Produk '${product.name}': stok tersedia ${product.stock}, diminta ${item.qty}`,
      };
    }

    const selected = bestDiscounts.get(product.id);
    const originalPrice = Number(product.price || 0);
    const productDiscountPerUnit = selected?.amount || 0;
    const effectivePrice = Math.max(originalPrice - productDiscountPerUnit, 0);
    return {
      product_id: product.id,
      product_name: product.name,
      seller_id: product.seller_id,
      seller: product.seller || null,
      category: product.category,
      qty: item.qty,
      original_price: originalPrice,
      effective_price: effectivePrice,
      original_subtotal: originalPrice * item.qty,
      product_discount_per_unit: productDiscountPerUnit,
      product_discount_total: productDiscountPerUnit * item.qty,
      subtotal_after_product_discount: effectivePrice * item.qty,
      active_discount: selected
        ? {
            id: selected.discount.id,
            discount_type: selected.discount.discount_type,
            discount_value: selected.discount.discount_value,
            discount_per_unit: productDiscountPerUnit,
            start_time: selected.discount.start_time,
            end_time: selected.discount.end_time,
          }
        : null,
    };
  });
};

const rejectVoucher = (rejected, code, reason) => {
  if (!code) return;
  rejected.push({ code: normalizeCode(code), reason });
};

const computeVoucherDiscount = (voucher, eligibleSubtotal, feeBase) => {
  if (voucher.discount_type === 'free_marketplace_fee') {
    return { discountAmount: feeBase, feeDiscount: feeBase, voucherDiscount: 0 };
  }
  const discountAmount = calculateDiscountAmount(
    voucher.discount_type,
    voucher.discount_value,
    eligibleSubtotal,
    voucher.max_discount
  );
  return { discountAmount, feeDiscount: 0, voucherDiscount: discountAmount };
};

const quotePromotions = async (payload) => {
  const items = payload.items || [];
  const quoteItems = await buildQuoteItems(items);
  const subtotalOriginal = quoteItems.reduce((sum, item) => sum + item.original_subtotal, 0);
  const productDiscountTotal = quoteItems.reduce((sum, item) => sum + item.product_discount_total, 0);
  const subtotalAfterProductDiscount = quoteItems.reduce((sum, item) => sum + item.subtotal_after_product_discount, 0);
  const { fee_marketplace: feeBase } = calculateFee(subtotalAfterProductDiscount);

  const marketplaceCode = normalizeCode(payload.marketplace_voucher_code);
  const sellerCodes = uniqueCodes(payload.seller_voucher_codes);
  const voucherCodes = uniqueCodes([marketplaceCode, ...sellerCodes]);
  const vouchers = await fetchVouchersByCodes(voucherCodes);
  const voucherByCode = new Map(vouchers.map((voucher) => [normalizeCode(voucher.code), voucher]));

  const appliedVouchers = [];
  const rejectedVouchers = [];
  let feeDiscount = 0;
  let voucherDiscountTotal = 0;
  const now = new Date();

  if (marketplaceCode) {
    const voucher = voucherByCode.get(marketplaceCode);
    if (!voucher) {
      rejectVoucher(rejectedVouchers, marketplaceCode, 'Voucher tidak ditemukan');
    } else if (voucher.seller_id) {
      rejectVoucher(rejectedVouchers, marketplaceCode, 'Kode ini bukan voucher marketplace');
    } else if (!isVoucherCurrentlyValid(voucher, now)) {
      rejectVoucher(rejectedVouchers, marketplaceCode, 'Voucher tidak aktif, habis kuota, atau di luar periode');
    } else {
      const eligibleSubtotal = quoteItems
        .filter((item) => !voucher.category || item.category === voucher.category)
        .reduce((sum, item) => sum + item.subtotal_after_product_discount, 0);
      if (eligibleSubtotal < Number(voucher.min_purchase || 0)) {
        rejectVoucher(rejectedVouchers, marketplaceCode, 'Minimum transaksi belum terpenuhi');
      } else {
        const discount = computeVoucherDiscount(voucher, eligibleSubtotal, feeBase);
        feeDiscount += discount.feeDiscount;
        voucherDiscountTotal += discount.voucherDiscount;
        appliedVouchers.push({
          id: voucher.id,
          code: voucher.code,
          scope: 'marketplace',
          seller_id: null,
          discount_type: voucher.discount_type,
          discount_amount: discount.discountAmount,
          eligible_subtotal: eligibleSubtotal,
        });
      }
    }
  }

  const usedSellerIds = new Set();
  for (const code of sellerCodes) {
    const voucher = voucherByCode.get(code);
    if (!voucher) {
      rejectVoucher(rejectedVouchers, code, 'Voucher tidak ditemukan');
      continue;
    }
    if (!voucher.seller_id) {
      rejectVoucher(rejectedVouchers, code, 'Kode ini bukan voucher seller');
      continue;
    }
    if (voucher.discount_type === 'free_marketplace_fee') {
      rejectVoucher(rejectedVouchers, code, 'Voucher seller tidak boleh gratis fee marketplace');
      continue;
    }
    if (usedSellerIds.has(voucher.seller_id)) {
      rejectVoucher(rejectedVouchers, code, 'Hanya satu voucher seller per toko');
      continue;
    }
    if (!isVoucherCurrentlyValid(voucher, now)) {
      rejectVoucher(rejectedVouchers, code, 'Voucher tidak aktif, habis kuota, atau di luar periode');
      continue;
    }

    const eligibleSubtotal = quoteItems
      .filter((item) => item.seller_id === voucher.seller_id && (!voucher.category || item.category === voucher.category))
      .reduce((sum, item) => sum + item.subtotal_after_product_discount, 0);
    if (eligibleSubtotal <= 0) {
      rejectVoucher(rejectedVouchers, code, 'Voucher tidak cocok dengan produk di checkout');
      continue;
    }
    if (eligibleSubtotal < Number(voucher.min_purchase || 0)) {
      rejectVoucher(rejectedVouchers, code, 'Minimum transaksi belum terpenuhi');
      continue;
    }

    const discountAmount = calculateDiscountAmount(
      voucher.discount_type,
      voucher.discount_value,
      eligibleSubtotal,
      voucher.max_discount
    );
    usedSellerIds.add(voucher.seller_id);
    voucherDiscountTotal += discountAmount;
    appliedVouchers.push({
      id: voucher.id,
      code: voucher.code,
      scope: 'seller',
      seller_id: voucher.seller_id,
      discount_type: voucher.discount_type,
      discount_amount: discountAmount,
      eligible_subtotal: eligibleSubtotal,
    });
  }

  feeDiscount = Math.min(feeDiscount, feeBase);
  const feeMarketplace = Math.max(feeBase - feeDiscount, 0);
  voucherDiscountTotal = Math.min(voucherDiscountTotal, subtotalAfterProductDiscount);
  const total = Math.max(subtotalAfterProductDiscount - voucherDiscountTotal + feeMarketplace, 0);
  const discountTotal = productDiscountTotal + voucherDiscountTotal + feeDiscount;

  return {
    subtotal_original: subtotalOriginal,
    product_discount_total: productDiscountTotal,
    subtotal_after_product_discount: subtotalAfterProductDiscount,
    fee_marketplace_base: feeBase,
    fee_discount: feeDiscount,
    fee_marketplace: feeMarketplace,
    voucher_discount_total: voucherDiscountTotal,
    discount_total: discountTotal,
    total,
    items: quoteItems,
    applied_vouchers: appliedVouchers,
    rejected_vouchers: rejectedVouchers,
  };
};

const getAvailableVouchers = async () => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('vouchers')
    .select('id, seller_id, code, discount_type, discount_value, min_purchase, max_discount, quota, used_count, start_time, end_time, category')
    .eq('is_active', true)
    .lte('start_time', now)
    .gt('end_time', now)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isPromotionSchemaError(error)) return [];
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }
  return (data || []).filter((voucher) => Number(voucher.used_count || 0) < Number(voucher.quota || 0));
};

const listSellerPromotions = async (sellerId) => {
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id, name, price, category')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (productError) throw { status: 500, code: 'INTERNAL_ERROR', message: productError.message };
  const productIds = (products || []).map((product) => product.id);

  const [discountsResult, vouchersResult] = await Promise.all([
    productIds.length
      ? supabase.from('product_discounts').select('*, product:products(id, name, price, category)').in('product_id', productIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from('vouchers').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false }),
  ]);
  if (discountsResult.error && !isPromotionSchemaError(discountsResult.error)) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: discountsResult.error.message };
  }
  if (vouchersResult.error && !isPromotionSchemaError(vouchersResult.error)) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: vouchersResult.error.message };
  }
  return {
    products: products || [],
    discounts: discountsResult.data || [],
    vouchers: vouchersResult.data || [],
  };
};

const assertSellerProduct = async (sellerId, productId) => {
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .single();
  if (error || !data) throw { status: 404, code: 'NOT_FOUND', message: 'Produk seller tidak ditemukan' };
};

const createSellerDiscount = async (sellerId, payload) => {
  await assertSellerProduct(sellerId, payload.product_id);
  const { data, error } = await supabase
    .from('product_discounts')
    .insert([{ ...payload, is_active: payload.is_active ?? true }])
    .select()
    .single();
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const updateSellerDiscount = async (sellerId, discountId, payload) => {
  const { data: discount, error: discountError } = await supabase
    .from('product_discounts')
    .select('id, product_id, product:products!inner(seller_id)')
    .eq('id', discountId)
    .single();
  if (discountError || !discount || discount.product?.seller_id !== sellerId) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Diskon produk tidak ditemukan' };
  }
  if (payload.product_id) await assertSellerProduct(sellerId, payload.product_id);
  const { data, error } = await supabase
    .from('product_discounts')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', discountId)
    .select()
    .single();
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const createSellerVoucher = async (sellerId, payload) => {
  const { data, error } = await supabase
    .from('vouchers')
    .insert([{ ...payload, seller_id: sellerId, min_purchase: payload.min_purchase ?? 0, is_active: payload.is_active ?? true }])
    .select()
    .single();
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const updateSellerVoucher = async (sellerId, voucherId, payload) => {
  const { data, error } = await supabase
    .from('vouchers')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', voucherId)
    .eq('seller_id', sellerId)
    .select()
    .single();
  if (error || !data) throw { status: 404, code: 'NOT_FOUND', message: 'Voucher toko tidak ditemukan' };
  return data;
};

const listMarketplaceVouchers = async () => {
  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .is('seller_id', null)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    if (isPromotionSchemaError(error)) return [];
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }
  return data || [];
};

const createMarketplaceVoucher = async (payload) => {
  const { data, error } = await supabase
    .from('vouchers')
    .insert([{ ...payload, seller_id: null, min_purchase: payload.min_purchase ?? 0, is_active: payload.is_active ?? true }])
    .select()
    .single();
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

const updateMarketplaceVoucher = async (voucherId, payload) => {
  const { data, error } = await supabase
    .from('vouchers')
    .update({ ...payload, seller_id: null, updated_at: new Date().toISOString() })
    .eq('id', voucherId)
    .is('seller_id', null)
    .select()
    .single();
  if (error || !data) throw { status: 404, code: 'NOT_FOUND', message: 'Voucher marketplace tidak ditemukan' };
  return data;
};

module.exports = {
  quotePromotions,
  getAvailableVouchers,
  enrichProductsWithPromotions,
  isPromotionSchemaError,
  listSellerPromotions,
  createSellerDiscount,
  updateSellerDiscount,
  createSellerVoucher,
  updateSellerVoucher,
  listMarketplaceVouchers,
  createMarketplaceVoucher,
  updateMarketplaceVoucher,
};
