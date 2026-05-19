const supabase = require('../../config/supabase');

const processCheckout = async (buyerId, payload) => {
  // payload: { productId, quantity, shippingAddress }
  
  if (!payload.productId || !payload.quantity || !payload.shippingAddress) {
    throw { status: 400, code: 'BAD_REQUEST', message: 'Parameter tidak lengkap' };
  }

  // 1. Get product to check stock and get price
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .eq('id', payload.productId)
    .single();

  if (prodErr || !product) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  }

  if (product.stock < payload.quantity) {
    throw { status: 400, code: 'OUT_OF_STOCK', message: 'Stok tidak mencukupi' };
  }

  // 2. Calculate prices
  const subtotal = product.price * payload.quantity;
  const adminFee = Math.round(subtotal * 0.02);
  const shippingFee = 15000; // Flat fee dummy
  const totalAmount = subtotal + adminFee + shippingFee;

  // 3. Create Order
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert([{
      buyer_id: buyerId,
      seller_id: product.seller_id,
      total_amount: totalAmount,
      shipping_fee: shippingFee,
      app_fee: adminFee,
      status: 'paid', // Langsung lunas krn backend dummy payment
      shipping_address: payload.shippingAddress
    }])
    .select()
    .single();

  if (orderErr) {
    console.error(orderErr);
    throw { status: 500, code: 'INTERNAL_ERROR', message: 'Gagal membuat order' };
  }

  // 4. Create Order Items
  const { error: itemErr } = await supabase
    .from('order_items')
    .insert([{
      order_id: order.id,
      product_id: product.id,
      quantity: payload.quantity,
      price_at_time: product.price
    }]);

  if (itemErr) {
    console.error(itemErr);
    // Ignore fail just for dummy
  }

  // 5. Kurangi stok produk
  const newStock = product.stock - payload.quantity;
  const updatePayload = { stock: newStock };
  if (newStock <= 0) {
    updatePayload.is_active = false;
  }

  await supabase
    .from('products')
    .update(updatePayload)
    .eq('id', product.id);

  return { success: true, order_id: order.id, payment_status: 'SUCCESS' };
};

module.exports = { processCheckout };
