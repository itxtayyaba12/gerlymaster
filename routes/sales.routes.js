const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sales.controller');

router.get('/', ctrl.getSales);
router.get('/:id', ctrl.getSaleById);
router.post('/', ctrl.createSale);
router.delete('/:id', ctrl.deleteSale);

module.exports = router;