const { z } = require('zod');

const productFields = {
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(2000),
  category: z.string().trim().min(2).max(60),
  price: z.number().int().min(100).max(1_000_000_000),
  stock: z.number().int().min(0).max(1_000_000),
  minimum_stock: z.number().int().min(0).max(1_000_000).default(5),
  image_url: z.url().nullable().optional(),
};

const createProductSchema = z.object(productFields);

const updateProductSchema = z.object({
  ...Object.fromEntries(
    Object.entries(productFields).map(([key, schema]) => [key, schema.optional()])
  ),
  is_active: z.boolean().optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'Minimal satu field harus diperbarui',
});

module.exports = { createProductSchema, updateProductSchema };
