const { z } = require('zod');

const itemSchema = z.object({
  product_id: z.string().uuid('Product ID tidak valid'),
  qty: z.number().int('Kuantitas harus bilangan bulat').min(1).max(100),
});

const quoteSchema = z.object({
  items: z.array(itemSchema).min(1, 'Items tidak boleh kosong').max(20, 'Maksimal 20 produk per checkout'),
  marketplace_voucher_code: z.string().trim().max(40).optional().nullable(),
  seller_voucher_codes: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
}).superRefine((data, context) => {
  const productIds = data.items.map((item) => item.product_id);
  if (new Set(productIds).size !== productIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['items'],
      message: 'Produk duplikat harus digabung menjadi satu item',
    });
  }
});

const discountBaseSchema = z.object({
  product_id: z.string().uuid('Product ID tidak valid'),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.number().int().min(1),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }),
  is_active: z.boolean().optional(),
});

const hasValidRange = (data) => {
  if (!data.start_time || !data.end_time) return true;
  return new Date(data.end_time) > new Date(data.start_time);
};

const discountSchema = discountBaseSchema.refine(hasValidRange, {
  path: ['end_time'],
  message: 'Waktu selesai harus setelah waktu mulai',
});

const updateDiscountSchema = discountBaseSchema.partial().refine(hasValidRange, {
  path: ['end_time'],
  message: 'Waktu selesai harus setelah waktu mulai',
});

const voucherBaseSchema = z.object({
  code: z.string().trim().min(3).max(40).transform((value) => value.toUpperCase()),
  discount_type: z.enum(['percentage', 'fixed_amount', 'free_marketplace_fee']),
  discount_value: z.number().int().min(1),
  min_purchase: z.number().int().min(0).optional(),
  max_discount: z.number().int().min(1).optional().nullable(),
  quota: z.number().int().min(1),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }),
  is_active: z.boolean().optional(),
  category: z.string().trim().min(1).max(80).optional().nullable(),
});

const voucherSchema = voucherBaseSchema.refine(hasValidRange, {
  path: ['end_time'],
  message: 'Waktu selesai harus setelah waktu mulai',
});

const sellerVoucherSchema = voucherSchema.refine((data) => data.discount_type !== 'free_marketplace_fee', {
  path: ['discount_type'],
  message: 'Voucher gratis fee marketplace hanya tersedia untuk voucher marketplace',
});

const marketplaceVoucherSchema = voucherSchema;

const updateSellerVoucherSchema = voucherBaseSchema.partial()
  .refine(hasValidRange, {
    path: ['end_time'],
    message: 'Waktu selesai harus setelah waktu mulai',
  })
  .refine((data) => data.discount_type !== 'free_marketplace_fee', {
    path: ['discount_type'],
    message: 'Voucher gratis fee marketplace hanya tersedia untuk voucher marketplace',
  });

const updateMarketplaceVoucherSchema = voucherBaseSchema.partial().refine(hasValidRange, {
  path: ['end_time'],
  message: 'Waktu selesai harus setelah waktu mulai',
});

module.exports = {
  quoteSchema,
  discountSchema,
  updateDiscountSchema,
  sellerVoucherSchema,
  updateSellerVoucherSchema,
  marketplaceVoucherSchema,
  updateMarketplaceVoucherSchema,
};
