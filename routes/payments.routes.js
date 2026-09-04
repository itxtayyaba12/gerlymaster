const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/payments.controller');

router.post('/:id/pay', ctrl.recordPayment);
router.get('/summary', ctrl.getPaymentSummary);

module.exports = router;