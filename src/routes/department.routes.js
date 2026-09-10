const express = require('express');
const controller = require('../controllers/department.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  createDepartmentSchema,
  updateDepartmentSchema,
  idParamSchema,
} = require('../validators/department.validator');

const router = express.Router();

// Public: needed by student registration before login
router.get('/', controller.list);

// Protected routes
router.use(authenticate);

router.get('/:id', validate({ params: idParamSchema }), controller.getOne);

router.post(
  '/',
  authorize('SUPER_ADMIN'),
  validate({ body: createDepartmentSchema }),
  controller.create
);

router.patch(
  '/:id',
  authorize('SUPER_ADMIN'),
  validate({ params: idParamSchema, body: updateDepartmentSchema }),
  controller.update
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN'),
  validate({ params: idParamSchema }),
  controller.remove
);

module.exports = router;
