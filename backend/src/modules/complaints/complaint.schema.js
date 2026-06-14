const { z } = require('zod');

const createComplaintSchema = z.object({
  type: z.enum(['damaged', 'missing_item', 'wrong_item', 'not_received', 'other']),
  description: z.string().min(10, 'Deskripsi minimal 10 karakter'),
});

const replyComplaintSchema = z.object({
  reply: z.string().min(10, 'Tanggapan minimal 10 karakter'),
});

const resolveComplaintSchema = z.object({
  accepted: z.boolean(),
});

const adminResolveComplaintSchema = z.object({
  action: z.enum(['resolved', 'rejected']),
  notes: z.string().min(5, 'Catatan minimal 5 karakter'),
});

module.exports = {
  createComplaintSchema,
  replyComplaintSchema,
  resolveComplaintSchema,
  adminResolveComplaintSchema,
};
