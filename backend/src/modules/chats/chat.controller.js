const {
  getMessagesByOrder,
  postMessage,
  listProductThreads,
  startProductThread,
  getProductMessages,
  sendProductThreadMessage,
} = require('./chat.service');
const { postMessageSchema, startProductChatSchema } = require('./chat.schema');

const parseLimit = (value, fallback = 50) => {
  const parsedLimit = Number.parseInt(value ?? String(fallback), 10);
  return Number.isFinite(parsedLimit) ? Math.min(200, Math.max(1, parsedLimit)) : fallback;
};

const getOrderMessages = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const limit = parseLimit(req.query.limit);

    const messages = await getMessagesByOrder(req.user, orderId, limit);
    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
};

const sendOrderMessage = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const payload = postMessageSchema.parse(req.body);

    const created = await postMessage(req.user, orderId, payload.content);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, message: error.issues?.[0]?.message ?? 'Input tidak valid' });
    }
    next(error);
  }
};

const getProductThreads = async (req, res, next) => {
  try {
    const threads = await listProductThreads(req.user);
    res.json({ success: true, data: threads });
  } catch (error) {
    next(error);
  }
};

const startProductChat = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const payload = startProductChatSchema.parse(req.body ?? {});
    const thread = await startProductThread(req.user, productId, payload.content ?? '');
    res.status(201).json({ success: true, data: thread });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, message: error.issues?.[0]?.message ?? 'Input tidak valid' });
    }
    next(error);
  }
};

const getProductThreadMessages = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const limit = parseLimit(req.query.limit);
    const messages = await getProductMessages(req.user, threadId, limit);
    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
};

const sendProductMessage = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const payload = postMessageSchema.parse(req.body);
    const created = await sendProductThreadMessage(req.user, threadId, payload.content);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, message: error.issues?.[0]?.message ?? 'Input tidak valid' });
    }
    next(error);
  }
};

module.exports = {
  getOrderMessages,
  sendOrderMessage,
  getProductThreads,
  startProductChat,
  getProductThreadMessages,
  sendProductMessage,
};

