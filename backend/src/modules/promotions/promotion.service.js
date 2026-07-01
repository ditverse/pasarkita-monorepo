const pool = require('../../config/mysql');
const { calculateFee } = require('../../utils/fee');

const normalizeCode = (code) => (code || '').trim().toUpperCase();
const uniqueCodes = (codes = []) => [...new Set(codes.map(normalizeCode).filter(Boolean))];

const calculateDiscountAmount = (type, value, base, maxDiscount = null) => {
  const raw = type === 'percentage' ? Math.round(base * (Number(value) || 0) / 100) : Number(value) || 0;
  const capped = maxDiscount ? Math.min(raw, Number(maxDiscount)) : raw;
  return Math.max(0, Math.min(capped, base));
};

const getDiscountPerUnit = (discount, price) => {
  if (!discount) return 0;
  const raw = discount.discount_type === 'percentage' ? Math.round(price * discount.discount_value / 100) : discount.discount_value;
  return Math.max(0, Math.min(raw, Math.max(price - 1, 0)));
};

const getActiveDiscounts = async (productIds) => {
  if (!productIds.length) return [];
  const now = new Date().toISOString();
  const [data] = await pool.query(
    `SELECT * FROM product_discounts WHERE product_id IN (${productIds.map(() => '?').join(',')}) AND is_active = 1 AND start_time <= ? AND end_time > ?`,
    [...productIds, now, now]
  );
  return data || [];
};

const chooseBestDiscounts = (discounts, productsById) => {
  const best = new Map();
  for (const d of discounts) {
    const product = productsById.get(d.product_id);
    if (!product) continue;
    const amount = getDiscountPerUnit(d, Number(product.price || 0));
    const current = best.get(d.product_id);
    if (!current || amount > current.amount) best.set(d.product_id, { discount: d, amount });
  }
  return best;
};

const enrichProductsWithPromotions = async (products) => {
  const list = Array.isArray(products) ? products : [products].filter(Boolean);
  if (list.length === 0) return Array.isArray(products) ? [] : products;

  const productsById = new Map(list.map(p => [p.id, p]));
  const discounts = await getActiveDiscounts([...productsById.keys()]);
  const best = chooseBestDiscounts(discounts, productsById);

  const enriched = list.map(product => {
    const selected = best.get(product.id);
    const originalPrice = Number(product.price || 0);
    const discountPerUnit = selected?.amount || 0;
    return {
      ...product, original_price: originalPrice, effective_price: Math.max(originalPrice - discountPerUnit, 0),
      active_discount: selected ? { id: selected.discount.id, discount_type: selected.discount.discount_type, discount_value: selected.discount.discount_value, discount_per_unit: discountPerUnit, start_time: selected.discount.start_time, end_time: selected.discount.end_time } : null,
    };
  });
  return Array.isArray(products) ? enriched : enriched[0];
};

const fetchProductsForQuote = async (items) => {
  const productIds = items.map(i => i.product_id);
  const [data] = await pool.query(
    `SELECT p.*, u.id AS seller_user_id, u.name AS seller_name
     FROM products p LEFT JOIN users u ON u.id = p.seller_id
     WHERE p.id IN (${productIds.map(() => '?').join(',')})`,
    productIds
  );
  return (data || []).map(p => ({ ...p, seller: p.seller_user_id ? { id: p.seller_user_id, name: p.seller_name } : null }));
};

const fetchVouchersByCodes = async (codes) => {
  const normalized = uniqueCodes(codes);
  if (normalized.length === 0) return [];
  const [data] = await pool.query(
    `SELECT * FROM vouchers WHERE code IN (${normalized.map(() => '?').join(',')})`,
    normalized
  );
  return data || [];
};

const isVoucherCurrentlyValid = (voucher, now = new Date()) =>
  voucher && voucher.is_active && new Date(voucher.start_time) <= now && new Date(voucher.end_time) > now && Number(voucher.used_count || 0) < Number(voucher.quota || 0);

const buildQuoteItems = async (items) => {
  const products = await fetchProductsForQuote(items);
  const productsById = new Map(products.map(p => [p.id, p]));
  const discounts = await getActiveDiscounts(items.map(i => i.product_id));
  const bestDiscounts = chooseBestDiscounts(discounts, productsById);

  return items.map(item => {
    const product = productsById.get(item.product_id);
    if (!product || !product.is_active) throw { status: 404, code: 'NOT_FOUND', message: `Produk tidak ditemukan: ${item.product_id}` };
    if (Number(product.stock || 0) < item.qty) throw { status: 400, code: 'INSUFFICIENT_STOCK', message: 'Stok tidak mencukupi', details: `Produk '${product.name}': stok tersedia ${product.stock}, diminta ${item.qty}` };

    const selected = bestDiscounts.get(product.id);
    const originalPrice = Number(product.price || 0);
    const productDiscountPerUnit = selected?.amount || 0;
    const effectivePrice = Math.max(originalPrice - productDiscountPerUnit, 0);
    return {
      product_id: product.id, product_name: product.name, seller_id: product.seller_id, seller: product.seller, category: product.category,
      qty: item.qty, original_price: originalPrice, effective_price: effectivePrice,
      original_subtotal: originalPrice * item.qty, product_discount_per_unit: productDiscountPerUnit,
      product_discount_total: productDiscountPerUnit * item.qty, subtotal_after_product_discount: effectivePrice * item.qty,
      active_discount: selected ? { id: selected.discount.id, discount_type: selected.discount.discount_type, discount_value: selected.discount.discount_value, discount_per_unit: productDiscountPerUnit, start_time: selected.discount.start_time, end_time: selected.discount.end_time } : null,
    };
  });
};

const quotePromotions = async (payload) => {
  const items = payload.items || [];
  const quoteItems = await buildQuoteItems(items);
  const subtotalOriginal = quoteItems.reduce((s, i) => s + i.original_subtotal, 0);
  const productDiscountTotal = quoteItems.reduce((s, i) => s + i.product_discount_total, 0);
  const subtotalAfterProductDiscount = quoteItems.reduce((s, i) => s + i.subtotal_after_product_discount, 0);
  const { fee_marketplace: feeBase } = calculateFee(subtotalAfterProductDiscount);

  const marketplaceCode = normalizeCode(payload.marketplace_voucher_code);
  const sellerCodes = uniqueCodes(payload.seller_voucher_codes);
  const vouchers = await fetchVouchersByCodes(uniqueCodes([marketplaceCode, ...sellerCodes]));
  const voucherByCode = new Map(vouchers.map(v => [normalizeCode(v.code), v]));

  const appliedVouchers = []; const rejectedVouchers = [];
  let feeDiscount = 0; let voucherDiscountTotal = 0; const now = new Date();

  if (marketplaceCode) {
    const voucher = voucherByCode.get(marketplaceCode);
    if (!voucher) { rejectedVouchers.push({ code: marketplaceCode, reason: 'Voucher tidak ditemukan' }); }
    else if (voucher.seller_id) { rejectedVouchers.push({ code: marketplaceCode, reason: 'Kode ini bukan voucher marketplace' }); }
    else if (!isVoucherCurrentlyValid(voucher, now)) { rejectedVouchers.push({ code: marketplaceCode, reason: 'Voucher tidak aktif atau habis kuota' }); }
    else {
      const eligibleSubtotal = quoteItems.filter(i => !voucher.category || i.category === voucher.category).reduce((s, i) => s + i.subtotal_after_product_discount, 0);
      if (eligibleSubtotal < Number(voucher.min_purchase || 0)) { rejectedVouchers.push({ code: marketplaceCode, reason: 'Minimum transaksi belum terpenuhi' }); }
      else {
        const discount = voucher.discount_type === 'free_marketplace_fee'
          ? { discountAmount: feeBase, feeDiscount: feeBase, voucherDiscount: 0 }
          : { discountAmount: calculateDiscountAmount(voucher.discount_type, voucher.discount_value, eligibleSubtotal, voucher.max_discount), feeDiscount: 0, voucherDiscount: calculateDiscountAmount(voucher.discount_type, voucher.discount_value, eligibleSubtotal, voucher.max_discount) };
        feeDiscount += discount.feeDiscount; voucherDiscountTotal += discount.voucherDiscount;
        appliedVouchers.push({ id: voucher.id, code: voucher.code, scope: 'marketplace', seller_id: null, discount_type: voucher.discount_type, discount_amount: discount.discountAmount, eligible_subtotal: eligibleSubtotal });
      }
    }
  }

  const usedSellerIds = new Set();
  for (const code of sellerCodes) {
    const voucher = voucherByCode.get(code);
    if (!voucher) { rejectedVouchers.push({ code, reason: 'Voucher tidak ditemukan' }); continue; }
    if (!voucher.seller_id) { rejectedVouchers.push({ code, reason: 'Kode ini bukan voucher seller' }); continue; }
    if (voucher.discount_type === 'free_marketplace_fee') { rejectedVouchers.push({ code, reason: 'Voucher seller tidak boleh gratis fee' }); continue; }
    if (usedSellerIds.has(voucher.seller_id)) { rejectedVouchers.push({ code, reason: 'Hanya satu voucher seller per toko' }); continue; }
    if (!isVoucherCurrentlyValid(voucher, now)) { rejectedVouchers.push({ code, reason: 'Voucher tidak aktif atau habis kuota' }); continue; }

    const eligibleSubtotal = quoteItems.filter(i => i.seller_id === voucher.seller_id && (!voucher.category || i.category === voucher.category)).reduce((s, i) => s + i.subtotal_after_product_discount, 0);
    if (eligibleSubtotal <= 0) { rejectedVouchers.push({ code, reason: 'Voucher tidak cocok dengan produk' }); continue; }
    if (eligibleSubtotal < Number(voucher.min_purchase || 0)) { rejectedVouchers.push({ code, reason: 'Minimum transaksi belum terpenuhi' }); continue; }

    const discountAmount = calculateDiscountAmount(voucher.discount_type, voucher.discount_value, eligibleSubtotal, voucher.max_discount);
    usedSellerIds.add(voucher.seller_id); voucherDiscountTotal += discountAmount;
    appliedVouchers.push({ id: voucher.id, code: voucher.code, scope: 'seller', seller_id: voucher.seller_id, discount_type: voucher.discount_type, discount_amount: discountAmount, eligible_subtotal: eligibleSubtotal });
  }

  feeDiscount = Math.min(feeDiscount, feeBase);
  const feeMarketplace = Math.max(feeBase - feeDiscount, 0);
  voucherDiscountTotal = Math.min(voucherDiscountTotal, subtotalAfterProductDiscount);
  const total = Math.max(subtotalAfterProductDiscount - voucherDiscountTotal + feeMarketplace, 0);

  return {
    subtotal_original: subtotalOriginal, product_discount_total: productDiscountTotal, subtotal_after_product_discount: subtotalAfterProductDiscount,
    fee_marketplace_base: feeBase, fee_discount: feeDiscount, fee_marketplace: feeMarketplace,
    voucher_discount_total: voucherDiscountTotal, discount_total: productDiscountTotal + voucherDiscountTotal + feeDiscount,
    total, items: quoteItems, applied_vouchers: appliedVouchers, rejected_vouchers: rejectedVouchers,
  };
};

const getAvailableVouchers = async () => {
  const now = new Date().toISOString();
  const [data] = await pool.query(
    "SELECT id, seller_id, code, discount_type, discount_value, min_purchase, max_discount, quota, used_count, start_time, end_time, category FROM vouchers WHERE is_active = 1 AND start_time <= ? AND end_time > ? ORDER BY created_at DESC LIMIT 100",
    [now, now]
  );
  return (data || []).filter(v => Number(v.used_count || 0) < Number(v.quota || 0));
};

const listSellerPromotions = async (sellerId) => {
  const [products] = await pool.query('SELECT id, name, price, category FROM products WHERE seller_id = ? ORDER BY created_at DESC LIMIT 500', [sellerId]);
  const productIds = products.map(p => p.id);

  let discounts = []; let vouchers = [];
  if (productIds.length > 0) {
    [discounts] = await pool.query(
      `SELECT pd.*, p.name AS product_name, p.price AS product_price FROM product_discounts pd
       INNER JOIN products p ON p.id = pd.product_id
       WHERE pd.product_id IN (${productIds.map(() => '?').join(',')}) ORDER BY pd.created_at DESC`,
      productIds
    );
  }
  [vouchers] = await pool.query('SELECT * FROM vouchers WHERE seller_id = ? ORDER BY created_at DESC', [sellerId]);
  return { products, discounts, vouchers };
};

const assertSellerProduct = async (sellerId, productId) => {
  const [rows] = await pool.query('SELECT id FROM products WHERE id = ? AND seller_id = ?', [productId, sellerId]);
  if (rows.length === 0) throw { status: 404, code: 'NOT_FOUND', message: 'Produk seller tidak ditemukan' };
};

const createSellerDiscount = async (sellerId, payload) => {
  await assertSellerProduct(sellerId, payload.product_id);
  const id = require('crypto').randomUUID();
  await pool.query(
    'INSERT INTO product_discounts (id, product_id, discount_type, discount_value, start_time, end_time, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, payload.product_id, payload.discount_type, payload.discount_value, payload.start_time, payload.end_time, payload.is_active ?? 1]
  );
  const [rows] = await pool.query('SELECT * FROM product_discounts WHERE id = ?', [id]);
  return rows[0];
};

const updateSellerDiscount = async (sellerId, discountId, payload) => {
  const [dRows] = await pool.query(
    `SELECT pd.id, pd.product_id, p.seller_id FROM product_discounts pd
     INNER JOIN products p ON p.id = pd.product_id WHERE pd.id = ?`, [discountId]
  );
  if (!dRows[0] || dRows[0].seller_id !== sellerId) throw { status: 404, code: 'NOT_FOUND', message: 'Diskon produk tidak ditemukan' };
  if (payload.product_id) await assertSellerProduct(sellerId, payload.product_id);

  const fields = []; const values = [];
  for (const [k, v] of Object.entries(payload)) {
    if (['product_id', 'discount_type', 'discount_value', 'start_time', 'end_time', 'is_active'].includes(k)) {
      fields.push(`${k} = ?`); values.push(v);
    }
  }
  if (fields.length > 0) { values.push(discountId); await pool.query(`UPDATE product_discounts SET ${fields.join(', ')} WHERE id = ?`, values); }
  const [rows] = await pool.query('SELECT * FROM product_discounts WHERE id = ?', [discountId]);
  return rows[0];
};

const createSellerVoucher = async (sellerId, payload) => {
  const id = require('crypto').randomUUID();
  await pool.query(
    'INSERT INTO vouchers (id, seller_id, code, discount_type, discount_value, min_purchase, max_discount, quota, start_time, end_time, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, sellerId, payload.code, payload.discount_type, payload.discount_value, payload.min_purchase ?? 0, payload.max_discount ?? null, payload.quota, payload.start_time, payload.end_time, payload.is_active ?? 1]
  );
  const [rows] = await pool.query('SELECT * FROM vouchers WHERE id = ?', [id]);
  return rows[0];
};

const updateSellerVoucher = async (sellerId, voucherId, payload) => {
  const fields = []; const values = [];
  for (const [k, v] of Object.entries(payload)) {
    if (['code', 'discount_type', 'discount_value', 'min_purchase', 'max_discount', 'quota', 'start_time', 'end_time', 'is_active', 'category'].includes(k)) {
      fields.push(`${k} = ?`); values.push(v);
    }
  }
  if (fields.length > 0) { values.push(voucherId, sellerId); await pool.query(`UPDATE vouchers SET ${fields.join(', ')} WHERE id = ? AND seller_id = ?`, values); }
  const [rows] = await pool.query('SELECT * FROM vouchers WHERE id = ? AND seller_id = ?', [voucherId, sellerId]);
  if (!rows[0]) throw { status: 404, code: 'NOT_FOUND', message: 'Voucher toko tidak ditemukan' };
  return rows[0];
};

const listMarketplaceVouchers = async () => {
  const [data] = await pool.query('SELECT * FROM vouchers WHERE seller_id IS NULL ORDER BY created_at DESC LIMIT 500');
  return data || [];
};

const createMarketplaceVoucher = async (payload) => {
  const id = require('crypto').randomUUID();
  await pool.query(
    'INSERT INTO vouchers (id, seller_id, code, discount_type, discount_value, min_purchase, max_discount, quota, start_time, end_time, is_active) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, payload.code, payload.discount_type, payload.discount_value, payload.min_purchase ?? 0, payload.max_discount ?? null, payload.quota, payload.start_time, payload.end_time, payload.is_active ?? 1]
  );
  const [rows] = await pool.query('SELECT * FROM vouchers WHERE id = ?', [id]);
  return rows[0];
};

const updateMarketplaceVoucher = async (voucherId, payload) => {
  const fields = []; const values = [];
  for (const [k, v] of Object.entries(payload)) {
    if (['code', 'discount_type', 'discount_value', 'min_purchase', 'max_discount', 'quota', 'start_time', 'end_time', 'is_active', 'category'].includes(k)) {
      fields.push(`${k} = ?`); values.push(v);
    }
  }
  if (fields.length > 0) { values.push(voucherId); await pool.query(`UPDATE vouchers SET ${fields.join(', ')} WHERE id = ? AND seller_id IS NULL`, values); }
  const [rows] = await pool.query('SELECT * FROM vouchers WHERE id = ? AND seller_id IS NULL', [voucherId]);
  if (!rows[0]) throw { status: 404, code: 'NOT_FOUND', message: 'Voucher marketplace tidak ditemukan' };
  return rows[0];
};

module.exports = {
  quotePromotions, getAvailableVouchers, enrichProductsWithPromotions,
  listSellerPromotions, createSellerDiscount, updateSellerDiscount,
  createSellerVoucher, updateSellerVoucher,
  listMarketplaceVouchers, createMarketplaceVoucher, updateMarketplaceVoucher,
};
