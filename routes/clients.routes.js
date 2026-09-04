const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/clients.controller');

router.get('/', ctrl.getClients);
router.post('/', ctrl.createClient);
router.put('/:id', ctrl.updateClient);
router.delete('/:id', ctrl.deleteClient);
router.get('/:id/history', ctrl.getClientHistory);

module.exports = router;