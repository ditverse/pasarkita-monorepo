const supabase = require('../../config/supabase');

const getUsers = async (query) => {
  const { data, count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  return { data: data || [], pagination: { total: count } };
};

const updateUserStatus = async (userId, payload) => {
  const { is_active, reason } = payload;

  // Cegah ban sesama superadmin
  const { data: target, error: findErr } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (findErr || !target) {
    throw { status: 404, code: 'NOT_FOUND', message: 'User tidak ditemukan' };
  }

  if (target.role === 'superadmin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Tidak bisa mengubah status superadmin' };
  }

  const { data, error } = await supabase
    .from('users')
    .update({ is_active })
    .eq('id', userId)
    .select('id, is_active')
    .single();

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  if (reason) {
    console.log(`User ${userId} status changed to is_active=${is_active}. Reason: ${reason}`);
  }

  return data;
};

const getAnalytics = async (query) => {
  const { data: orders, error } = await supabase.from('orders').select('status, total, fee_marketplace');
  const { data: users } = await supabase.from('users').select('id');
  const { data: products } = await supabase.from('products').select('id');

  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  let totalRevenue = 0;
  let totalFee = 0;
  const groupedStatus = { paid: 0, shipped: 0, delivered: 0, pending: 0, payment_failed: 0 };

  (orders || []).forEach((o) => {
    totalRevenue += Number(o.total);
    totalFee += Number(o.fee_marketplace);
    if (groupedStatus[o.status] !== undefined) {
      groupedStatus[o.status]++;
    } else {
      groupedStatus[o.status] = 1;
    }
  });

  const totalOrders = orders?.length || 0;

  return {
    metrics: {
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      marketplace_fee: totalFee,
      new_users: users?.length || 0,
      total_products: products?.length || 0,
    },
    orders_by_status: Object.entries(groupedStatus)
      .map(([key, count]) => ({
        key,
        count,
        pct: totalOrders ? Math.round((count / totalOrders) * 100) : 0,
      }))
      .filter((x) => x.count > 0),
    top_products: [],
  };
};

module.exports = { getUsers, updateUserStatus, getAnalytics };
