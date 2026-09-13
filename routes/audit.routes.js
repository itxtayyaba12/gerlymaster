const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/audit.controller');

router.get('/deletions', ctrl.getDeletionLogs);

module.exports = router;