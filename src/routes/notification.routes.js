const express = require('express');
const controller = require('../controllers/notification.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { z } = require('zod');

const router = express.Router();
router.use(authenticate);

router.get('/', controller.list);
router.patch('/:id/read', validate({ params: z.object({ id: z.string().uuid() }) }), controller.markRead);
router.patch('/read-all', controller.markAllRead);

module.exports = router;
