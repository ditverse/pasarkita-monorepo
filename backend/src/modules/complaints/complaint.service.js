const supabase = require('../../config/supabase');
const { 
  notifyComplaintCreated, 
  notifyComplaintReplied, 
  notifyComplaintResolved 
} = require('../notifications/notification.service');

const createComplaint = async (buyerId, orderId, payload) => {
  // 1. Cek order milik buyer
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, status, buyer_id, order_items(product_id, products(seller_id))')
    .eq('id', orderId)
    .single();

  if (orderErr || !order) {
    throw { status: 404, message: 'Pesanan tidak ditemukan' };
  }
  if (order.buyer_id !== buyerId) {
    throw { status: 403, message: 'Tidak diizinkan mengakses pesanan ini' };
  }
  
  // Hanya bisa komplain jika shipped atau delivered
  if (!['shipped', 'delivered'].includes(order.status)) {
    throw { status: 400, message: 'Komplain hanya dapat diajukan untuk pesanan yang sudah dikirim atau diterima' };
  }

  // Cek apakah sudah ada komplain
  const { data: existing } = await supabase
    .from('complaints')
    .select('id')
    .eq('order_id', orderId)
    .single();
  
  if (existing) {
    throw { status: 400, message: 'Komplain untuk pesanan ini sudah diajukan sebelumnya' };
  }

  // Dapatkan seller_id (karena 1 order = 1 checkout product di MVP)
  const sellerId = order.order_items[0]?.products?.seller_id;
  if (!sellerId) {
    throw { status: 500, message: 'Gagal mendeteksi penjual' };
  }

  // Insert komplain
  const { data: complaint, error: compErr } = await supabase
    .from('complaints')
    .insert([{
      order_id: orderId,
      buyer_id: buyerId,
      seller_id: sellerId,
      type: payload.type,
      description: payload.description,
      status: 'open'
    }])
    .select()
    .single();

  if (compErr) {
    throw { status: 500, message: compErr.message };
  }

  void notifyComplaintCreated(sellerId, orderId);

  return complaint;
};

const getComplaints = async (userId, role, filters = {}) => {
  let query = supabase.from('complaints').select(`
    *,
    orders(status, total, created_at, tracking_id),
    buyer:buyer_id(name, email),
    seller:seller_id(name, email)
  `);

  if (role === 'buyer') {
    query = query.eq('buyer_id', userId);
  } else if (role === 'seller') {
    query = query.eq('seller_id', userId);
  } else if (role === 'superadmin') {
    // Admin bisa melihat semua, bisa filter status
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw { status: 500, message: error.message };
  return data;
};

const getComplaintById = async (complaintId, userId, role) => {
  const { data, error } = await supabase
    .from('complaints')
    .select(`
      *,
      orders(status, total, created_at, tracking_id),
      buyer:buyer_id(name, email),
      seller:seller_id(name, email)
    `)
    .eq('id', complaintId)
    .single();

  if (error || !data) throw { status: 404, message: 'Komplain tidak ditemukan' };

  if (role === 'buyer' && data.buyer_id !== userId) throw { status: 403, message: 'Akses ditolak' };
  if (role === 'seller' && data.seller_id !== userId) throw { status: 403, message: 'Akses ditolak' };

  return data;
};

const replyComplaint = async (sellerId, complaintId, replyText) => {
  const comp = await getComplaintById(complaintId, sellerId, 'seller');
  if (comp.status !== 'open') {
    throw { status: 400, message: 'Hanya bisa merespons komplain yang berstatus open' };
  }

  const { data, error } = await supabase
    .from('complaints')
    .update({ 
      seller_response: replyText,
      status: 'seller_replied'
    })
    .eq('id', complaintId)
    .select()
    .single();
  
  if (error) throw { status: 500, message: error.message };

  void notifyComplaintReplied(comp.buyer_id, comp.order_id);

  return data;
};

const resolveComplaint = async (buyerId, complaintId, accepted) => {
  const comp = await getComplaintById(complaintId, buyerId, 'buyer');
  if (comp.status !== 'seller_replied') {
    throw { status: 400, message: 'Komplain belum direspons penjual' };
  }

  const newStatus = accepted ? 'resolved' : 'admin_review';

  const { data, error } = await supabase
    .from('complaints')
    .update({ status: newStatus })
    .eq('id', complaintId)
    .select()
    .single();

  if (error) throw { status: 500, message: error.message };

  if (accepted) {
    void notifyComplaintResolved(comp.seller_id, comp.order_id, true);
  }

  return data;
};

const adminResolveComplaint = async (adminId, complaintId, payload) => {
  const comp = await getComplaintById(complaintId, adminId, 'superadmin');
  if (comp.status !== 'admin_review') {
    throw { status: 400, message: 'Hanya komplain dengan status admin_review yang bisa diputuskan admin' };
  }

  const { data, error } = await supabase
    .from('complaints')
    .update({ 
      status: payload.action, // 'resolved' atau 'rejected'
      admin_notes: payload.notes
    })
    .eq('id', complaintId)
    .select()
    .single();

  if (error) throw { status: 500, message: error.message };
  
  // Catat audit log
  await supabase.from('admin_audit_logs').insert([{
    actor_id: adminId,
    action: `resolve_complaint_${payload.action}`,
    target_type: 'complaint',
    target_id: complaintId,
    reason: payload.notes
  }]);

  void notifyComplaintResolved(comp.buyer_id, comp.order_id, false);
  void notifyComplaintResolved(comp.seller_id, comp.order_id, true);

  return data;
};

module.exports = {
  createComplaint,
  getComplaints,
  getComplaintById,
  replyComplaint,
  resolveComplaint,
  adminResolveComplaint,
};
