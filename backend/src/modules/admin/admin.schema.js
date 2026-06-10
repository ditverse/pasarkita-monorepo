const { z } = require('zod');

const updateUserStatusSchema = z.object({
  is_active: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

const moderateProductSchema = z.object({
  is_active: z.boolean(),
  reason: z.string().trim().min(5).max(500),
  rule: z.enum([
    'policy_violation',
    'misleading_information',
    'prohibited_product',
    'quality_risk',
    'seller_request',
    'stock_restored',
    'review_completed',
    'other',
  ]),
});

module.exports = { updateUserStatusSchema, moderateProductSchema };
