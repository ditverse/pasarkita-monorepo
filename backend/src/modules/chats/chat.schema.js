const { z } = require('zod');

const postMessageSchema = z.object({
  content: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(2000, 'Pesan maksimal 2000 karakter'),
});

const startProductChatSchema = z.object({
  content: z.string().trim().max(2000, 'Pesan maksimal 2000 karakter').optional(),
});

module.exports = {
  postMessageSchema,
  startProductChatSchema,
};

