const { z } = require('zod');

const createAdSchema = z.object({
  product_id: z.string().uuid('Product ID harus berupa UUID yang valid'),
  start_date: z.string().datetime({ message: 'Start date harus format ISO8601 datetime' }),
  end_date: z.string().datetime({ message: 'End date harus format ISO8601 datetime' }),
  title: z.preprocess(val => (val === '' || val === null) ? undefined : val, z.string().min(3, 'Judul iklan minimal 3 karakter').max(100, 'Judul iklan maksimal 100 karakter').optional()),
  caption: z.preprocess(val => (val === '' || val === null) ? undefined : val, z.string().min(5, 'Caption iklan minimal 5 karakter').max(255, 'Caption iklan maksimal 255 karakter').optional()),
}).refine(data => new Date(data.end_date) > new Date(data.start_date), {
  message: 'Tanggal selesai harus setelah tanggal mulai',
  path: ['end_date'],
});

const bannerShape = z.object({
  title: z.string().min(3, 'Judul banner minimal 3 karakter').max(100, 'Judul banner maksimal 100 karakter'),
  subtitle: z.string().max(255, 'Subtitle banner maksimal 255 karakter').optional(),
  image_url: z.string().url('URL Gambar tidak valid'),
  target_url: z.string().max(255, 'URL Target maksimal 255 karakter').optional(),
  placement: z.string().default('home_carousel'),
  start_time: z.string().datetime({ message: 'Start time harus format ISO8601 datetime' }),
  end_time: z.string().datetime({ message: 'End time harus format ISO8601 datetime' }),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

const createBannerSchema = bannerShape.refine(data => new Date(data.end_time) > new Date(data.start_time), {
  message: 'Tanggal selesai harus setelah tanggal mulai',
  path: ['end_time'],
});

const updateBannerSchema = bannerShape.partial().refine(data => {
  if (data.start_time && data.end_time) {
    return new Date(data.end_time) > new Date(data.start_time);
  }
  return true;
}, {
  message: 'Tanggal selesai harus setelah tanggal mulai',
  path: ['end_time'],
});

const moderateAdSchema = z.object({
  status: z.enum(['active', 'paused', 'rejected'], {
    errorMap: () => ({ message: 'Status harus active, paused, atau rejected' })
  }),
  reason: z.string().min(3, 'Alasan moderasi minimal 3 karakter').optional(),
});

module.exports = {
  createAdSchema,
  createBannerSchema,
  updateBannerSchema,
  moderateAdSchema,
};
