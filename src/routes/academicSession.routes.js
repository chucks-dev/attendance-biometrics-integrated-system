const express = require('express');
const controller = require('../controllers/academicSession.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  createSessionSchema,
  createSemesterSchema,
  idParamSchema,
} = require('../validators/academic.validator');

const router = express.Router();
router.use(authenticate);

router.get('/', controller.listSessions);
router.post('/', authorize('SUPER_ADMIN'), validate({ body: createSessionSchema }), controller.createSession);
router.patch(
  '/:id/activate',
  authorize('SUPER_ADMIN'),
  validate({ params: idParamSchema }),
  controller.activateSession
);

router.post(
  '/semesters',
  authorize('SUPER_ADMIN'),
  validate({ body: createSemesterSchema }),
  controller.createSemester
);
router.patch(
  '/semesters/:id/activate',
  authorize('SUPER_ADMIN'),
  validate({ params: idParamSchema }),
  controller.activateSemester
);

module.exports = router;
