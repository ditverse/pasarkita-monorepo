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

const getPublicStore = async (req, res, next) => {
  try {
    const data = await productService.getPublicStore(req.params.sellerId);
    return successResponse(res, 200, 'Profil toko', data);
  } catch (err) {
    next(err);
  }
};

const getMyProducts = async (req, res, next) => {
  try {
    const result = await productService.getProductsBySeller(req.user.id, req.query);
    return successResponse(res, 200, 'Daftar produk seller', result.data, result.pagination);
  } catch (err) {
    next(err);
  }
};

const getMyProductById = async (req, res, next) => {
  try {
    const data = await productService.getProductBySeller(req.user.id, req.params.id);
    return successResponse(res, 200, 'Detail produk seller', data);
  } catch (err) {
    next(err);
  }
};

const uploadProductImage = async (req, res, next) => {
  try {
    const data = await productService.uploadProductImage(req.user.id, req.file);
    return successResponse(res, 201, 'Gambar produk berhasil diunggah', data);
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

const exportMyProducts = async (req, res, next) => {
  try {
    const result = await productService.exportProductsBySeller(req.user.id, req.query);
    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="produk-toko-${timestamp}.csv"`);
    if (result.truncated) {
      res.setHeader('X-Export-Truncated', 'true');
      res.setHeader('X-Export-Count', String(result.count));
    }
    return res.send('\uFEFF' + result.csv); // BOM untuk Excel
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProducts,
  getProductById,
  getPublicStore,
  getMyProducts,
  getMyProductById,
  uploadProductImage,
  createProduct,
  updateProduct,
  deleteProduct,
  exportMyProducts,
};
