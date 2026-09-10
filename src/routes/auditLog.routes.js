const express = require('express');
const controller = require('../controllers/auditLog.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate, authorize('SUPER_ADMIN'));

router.get('/', controller.list);

module.exports = router;
