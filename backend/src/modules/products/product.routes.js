const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const { verifyToken, requireSeller } = require('../../middlewares/auth');

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', verifyToken, requireSeller, productController.createProduct);
router.put('/:id', verifyToken, productController.updateProduct);
router.delete('/:id', verifyToken, productController.deleteProduct);

module.exports = router;
