const express = require('express');
const controller = require('../controllers/user.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { userQuerySchema, updateStatusSchema, idParamSchema } = require('../validators/user.validator');

const router = express.Router();
router.use(authenticate, authorize('SUPER_ADMIN'));

router.get('/students', validate({ query: userQuerySchema }), controller.listStudents);
router.get('/lecturers', validate({ query: userQuerySchema }), controller.listLecturers);
router.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: updateStatusSchema }),
  controller.updateUserStatus
);
router.delete('/:id', validate({ params: idParamSchema }), controller.deleteUser);

module.exports = router;
