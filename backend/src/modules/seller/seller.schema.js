const { z } = require('zod');

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const phonePattern = /^[+]?[0-9][0-9\s-]{7,19}$/;

const updateStoreProfileSchema = z.object({
  store_name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(1000),
  pickup_address: z.string().trim().min(10).max(500),
  contact_phone: z.string().trim().regex(phonePattern, 'Nomor telepon tidak valid'),
  open_time: z.string().regex(timePattern, 'Jam buka tidak valid'),
  close_time: z.string().regex(timePattern, 'Jam tutup tidak valid'),
  processing_days: z.number().int().min(1).max(30),
  logo_url: z.url().nullable().optional(),
}).refine((profile) => profile.open_time !== profile.close_time, {
  message: 'Jam buka dan tutup tidak boleh sama',
  path: ['close_time'],
});

module.exports = { updateStoreProfileSchema };
