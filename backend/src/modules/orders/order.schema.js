const { z } = require('zod');

const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'processing', 'shipped', 'delivered', 'payment_failed']),
  reason: z.string().trim().min(3).max(500).optional(),
});

const processOrderSchema = z.object({
  pickup_address: z.string().trim().min(10).max(500),
});

module.exports = { updateOrderStatusSchema, processOrderSchema };
