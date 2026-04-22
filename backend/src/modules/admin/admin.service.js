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
  // Dalam realita, kita update custom claims app_metadata.is_active di auth.users lewat Admin API
  // Tapi untuk dummy, kita anggap return success
  return { success: true };
};

const getAnalytics = async (query) => {
  // Ambil metrics
  const { data: orders, error } = await supabase.from('orders').select('*');
  const { data: users } = await supabase.from('users').select('id');
  
  if (error) throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };

  let totalRevenue = 0;
  let totalAppFee = 0;
  let groupedStatus = { paid: 0, shipped: 0, delivered: 0, pending: 0, cancelled: 0 };

  (orders || []).forEach(o => {
    totalRevenue += Number(o.total_amount);
    totalAppFee += Number(o.app_fee);
    if (groupedStatus[o.status] !== undefined) {
      groupedStatus[o.status]++;
    } else {
      groupedStatus[o.status] = 1;
    }
  });

  return {
    metrics: {
      total_orders: orders?.length || 0,
      total_revenue: totalRevenue,
      marketplace_fee: totalAppFee,
      new_users: users?.length || 0,
    },
    orders_by_status: Object.entries(groupedStatus).map(([key, count]) => ({
      key,
      count,
      pct: orders?.length ? Math.round((count / orders.length) * 100) : 0
    })).filter(x => x.count > 0),
    top_products: [] // Dikosongkan sementara untuk limitasi complexity DB tanpa RPC group by
  };
};

module.exports = { getUsers, updateUserStatus, getAnalytics };
