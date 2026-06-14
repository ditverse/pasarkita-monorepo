const express = require('express');
const multer = require('multer');
const router = express.Router();
const productController = require('./product.controller');
const { verifyToken, requireSeller } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { createProductSchema, updateProductSchema } = require('./product.schema');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Format gambar harus JPG, PNG, atau WebP');
      error.status = 400;
      error.code = 'INVALID_IMAGE_TYPE';
      return callback(error);
    }
    callback(null, true);
  },
});

router.get('/', productController.getProducts);
router.get('/mine', verifyToken, requireSeller, productController.getMyProducts);
router.get('/mine/export', verifyToken, requireSeller, productController.exportMyProducts);
router.get('/mine/:id', verifyToken, requireSeller, productController.getMyProductById);
router.post('/images', verifyToken, requireSeller, upload.single('image'), productController.uploadProductImage);
router.get('/stores/:sellerId', productController.getPublicStore);
router.get('/:id', productController.getProductById);
router.post('/', verifyToken, requireSeller, validate(createProductSchema), productController.createProduct);
router.put('/:id', verifyToken, validate(updateProductSchema), productController.updateProduct);
router.delete('/:id', verifyToken, productController.deleteProduct);

module.exports = router;
