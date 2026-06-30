const { z } = require('zod');

const checkoutSchema = z.object({
  idempotency_key: z.string().uuid('Idempotency key tidak valid'),
  items: z.array(
    z.object({
      product_id: z.string().uuid('Product ID tidak valid'),
      qty: z.number().int('Kuantitas harus bilangan bulat').min(1).max(100),
    })
  ).min(1, 'Items tidak boleh kosong').max(20, 'Maksimal 20 produk per checkout'),
  shipping_address: z.string().trim().min(10, 'Alamat minimal 10 karakter').max(500),
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

module.exports = { checkoutSchema };
