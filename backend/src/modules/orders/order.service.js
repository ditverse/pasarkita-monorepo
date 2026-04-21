const getOrders = async (user, query) => {
  return { data: [], pagination: {} };
};

const getOrderById = async (user, orderId) => {
  return { message: 'Not implemented' };
};

const updateOrderStatus = async (orderId, status) => {
  return { message: 'Not implemented' };
};

module.exports = { getOrders, getOrderById, updateOrderStatus };
