const supabase = require('../../config/supabase');

const getOrderChatAccess = async (user, orderId) => {
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, buyer_id, items:order_items(product:products(seller_id))')
    .eq('id', orderId)
    .single();

  if (error || !order) throw { status: 404, code: 'NOT_FOUND', message: 'Pesanan tidak ditemukan' };

  const sellerIds = new Set(
    (order.items || [])
      .map((item) => item.product?.seller_id)
      .filter(Boolean)
  );

  if (user.role === 'superadmin') return { order, role: 'admin' };
  if (order.buyer_id === user.id) return { order, role: 'buyer' };
  if (sellerIds.has(user.id)) return { order, role: 'seller' };

  throw { status: 403, code: 'FORBIDDEN', message: 'Tidak diizinkan mengakses chat pesanan ini' };
};

const getMessagesByOrder = async (user, orderId, limit = 50) => {
  await getOrderChatAccess(user, orderId);

  const { data, error } = await supabase
    .from('order_chat_messages')
    .select('id, order_id, sender_id, content, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw { status: 500, message: error.message };
  return data;
};

const postMessage = async (user, orderId, content) => {
  const access = await getOrderChatAccess(user, orderId);

  if (access.role === 'admin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Admin hanya dapat memantau chat pesanan' };
  }

  const { data: created, error: createErr } = await supabase
    .from('order_chat_messages')
    .insert([{ order_id: orderId, sender_id: user.id, content }])
    .select()
    .single();

  if (createErr) throw { status: 500, message: createErr.message };
  return created;
};

const mapProductThread = (thread) => ({
  id: thread.id,
  product_id: thread.product_id,
  buyer_id: thread.buyer_id,
  seller_id: thread.seller_id,
  created_at: thread.created_at,
  updated_at: thread.updated_at,
  product: thread.product
    ? {
        id: thread.product.id,
        name: thread.product.name,
        image_url: thread.product.image_url,
        price: thread.product.price,
      }
    : null,
  buyer: thread.buyer
    ? {
        id: thread.buyer.id,
        name: thread.buyer.name,
        email: thread.buyer.email,
      }
    : null,
  seller: thread.seller
    ? {
        id: thread.seller.id,
        name: thread.seller.name,
        email: thread.seller.email,
      }
    : null,
  last_message: thread.last_message ?? null,
});

const getProductThreadAccess = async (user, threadId) => {
  const { data: thread, error } = await supabase
    .from('product_chat_threads')
    .select('id, product_id, buyer_id, seller_id')
    .eq('id', threadId)
    .single();

  if (error || !thread) throw { status: 404, code: 'NOT_FOUND', message: 'Thread chat tidak ditemukan' };
  if (user.role === 'superadmin') return { thread, role: 'admin' };
  if (thread.buyer_id === user.id) return { thread, role: 'buyer' };
  if (thread.seller_id === user.id) return { thread, role: 'seller' };

  throw { status: 403, code: 'FORBIDDEN', message: 'Tidak diizinkan mengakses thread chat ini' };
};

const listProductThreads = async (user) => {
  let query = supabase
    .from('product_chat_threads')
    .select(`
      id, product_id, buyer_id, seller_id, created_at, updated_at,
      product:products(id, name, image_url, price),
      buyer:users!buyer_id(id, name, email),
      seller:users!seller_id(id, name, email)
    `)
    .order('updated_at', { ascending: false });

  if (user.role === 'buyer') {
    query = query.eq('buyer_id', user.id);
  } else if (user.role === 'seller') {
    query = query.eq('seller_id', user.id);
  } else if (user.role !== 'superadmin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Role tidak diizinkan mengakses chat produk' };
  }

  const { data, error } = await query;
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  const threads = data || [];
  const threadIds = threads.map((thread) => thread.id);
  if (threadIds.length === 0) return [];

  const { data: messages, error: messagesError } = await supabase
    .from('product_chat_messages')
    .select('id, thread_id, sender_id, content, created_at')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: false });

  if (messagesError) throw { status: 500, code: 'INTERNAL_ERROR', message: messagesError.message };

  const lastMessageByThread = new Map();
  for (const message of messages || []) {
    if (!lastMessageByThread.has(message.thread_id)) {
      lastMessageByThread.set(message.thread_id, message);
    }
  }

  return threads.map((thread) => mapProductThread({
    ...thread,
    last_message: lastMessageByThread.get(thread.id) ?? null,
  }));
};

const startProductThread = async (user, productId, initialContent = '') => {
  if (user.role !== 'buyer') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Hanya buyer yang dapat memulai chat produk' };
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, seller_id, is_active')
    .eq('id', productId)
    .single();

  if (productError || !product || !product.is_active) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  }
  if (product.seller_id === user.id) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Tidak dapat chat toko sendiri' };
  }

  const { data: thread, error: upsertError } = await supabase
    .from('product_chat_threads')
    .upsert(
      {
        product_id: product.id,
        buyer_id: user.id,
        seller_id: product.seller_id,
      },
      { onConflict: 'product_id,buyer_id,seller_id' }
    )
    .select('id, product_id, buyer_id, seller_id, created_at, updated_at')
    .single();

  if (upsertError) throw { status: 500, code: 'INTERNAL_ERROR', message: upsertError.message };

  const trimmedContent = initialContent.trim();
  if (trimmedContent) {
    await sendProductThreadMessage(user, thread.id, trimmedContent);
  }

  return thread;
};

const getProductMessages = async (user, threadId, limit = 50) => {
  await getProductThreadAccess(user, threadId);

  const { data, error } = await supabase
    .from('product_chat_messages')
    .select('id, thread_id, sender_id, content, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data || [];
};

const sendProductThreadMessage = async (user, threadId, content) => {
  const access = await getProductThreadAccess(user, threadId);
  if (access.role === 'admin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Admin hanya dapat memantau chat produk' };
  }

  const { data, error } = await supabase
    .from('product_chat_messages')
    .insert([{ thread_id: threadId, sender_id: user.id, content }])
    .select('id, thread_id, sender_id, content, created_at')
    .single();

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  return data;
};

module.exports = {
  getMessagesByOrder,
  postMessage,
  listProductThreads,
  startProductThread,
  getProductMessages,
  sendProductThreadMessage,
};

