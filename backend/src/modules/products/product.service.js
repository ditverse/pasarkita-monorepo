const getProducts = async (query) => {
  return { data: [], pagination: {} };
};

const getProductById = async (id) => {
  return { message: 'Not implemented' };
};

const createProduct = async (sellerId, payload) => {
  return { message: 'Not implemented' };
};

const updateProduct = async (user, productId, payload) => {
  return { message: 'Not implemented' };
};

const deleteProduct = async (user, productId) => {
  return { message: 'Not implemented' };
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct };
