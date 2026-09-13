const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/products.controller');

router.get('/', ctrl.getProducts);
router.get('/low-stock', ctrl.getLowStock);
router.get('/:id/sales-history', ctrl.getProductSalesHistory);
router.post('/', ctrl.createProduct);
router.put('/:id', ctrl.updateProduct);
router.delete('/:id', ctrl.deleteProduct);

module.exports = router;