const { z } = require('zod');

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  phone: z.string().max(30, 'Nomor HP maksimal 30 karakter').nullable().optional(),
  avatar_url: z.string().url('URL avatar tidak valid').nullable().optional(),
});

const addressSchema = z.object({
  label: z.string().min(1, 'Label alamat wajib diisi (misal: Rumah)').max(50),
  recipient_name: z.string().min(2, 'Nama penerima minimal 2 karakter'),
  phone: z.string().min(5, 'Nomor HP minimal 5 karakter').max(30),
  full_address: z.string().min(10, 'Alamat lengkap minimal 10 karakter'),
  is_primary: z.boolean().default(false).optional(),
});

module.exports = {
  updateProfileSchema,
  addressSchema,
};
