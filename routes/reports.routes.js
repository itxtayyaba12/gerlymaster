const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reports.controller');

router.get('/dashboard-summary', ctrl.dashboardSummary);
router.get('/profit-by-product', ctrl.profitByProduct);
router.get('/profit-by-customer', ctrl.profitByCustomer);
router.get('/profit-by-timeframe', ctrl.profitByTimeframe);

module.exports = router;