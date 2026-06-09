const { z } = require('zod');

const updateUserStatusSchema = z.object({
  is_active: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

module.exports = { updateUserStatusSchema };
