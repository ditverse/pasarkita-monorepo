const { z } = require('zod');

const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'payment_failed']),
  reason: z.string().trim().min(3).max(500).optional(),
});

module.exports = { updateOrderStatusSchema };
