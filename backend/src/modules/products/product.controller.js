const productService = require('./product.service');
const { successResponse } = require('../../utils/response');

const getProducts = async (req, res, next) => {
  try {
    const result = await productService.getProducts(req.query);
    return successResponse(res, 200, 'Daftar produk', result.data, result.pagination);
  } catch (err) {
    next(err);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const data = await productService.getProductById(req.params.id);
    return successResponse(res, 200, 'Detail produk', data);
  } catch (err) {
    next(err);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const data = await productService.createProduct(req.user.id, req.body);
    return successResponse(res, 201, 'Produk berhasil ditambahkan', data);
  } catch (err) {
    next(err);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const data = await productService.updateProduct(req.user, req.params.id, req.body);
    return successResponse(res, 200, 'Produk berhasil diperbarui', data);
  } catch (err) {
    next(err);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    await productService.deleteProduct(req.user, req.params.id);
    return successResponse(res, 200, 'Produk berhasil dihapus');
  } catch (err) {
    next(err);
  }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct };
