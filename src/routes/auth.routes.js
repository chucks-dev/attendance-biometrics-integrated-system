const express = require('express');
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rateLimit');
const {
  adminLoginSchema,
  lecturerRegisterSchema,
  lecturerLoginSchema,
  studentRegisterSchema,
  studentLoginSchema,
  changePasswordSchema,
} = require('../validators/auth.validator');

const router = express.Router();

// Admin — no public registration route by design.
router.post('/admin/login', authLimiter, validate({ body: adminLoginSchema }), controller.adminLogin);

// Lecturer
router.post(
  '/lecturer/register',
  authLimiter,
  validate({ body: lecturerRegisterSchema }),
  controller.lecturerRegister
);
router.post('/lecturer/login', authLimiter, validate({ body: lecturerLoginSchema }), controller.lecturerLogin);

// Student
router.post(
  '/student/register',
  authLimiter,
  validate({ body: studentRegisterSchema }),
  controller.studentRegister
);
router.post('/student/login', authLimiter, validate({ body: studentLoginSchema }), controller.studentLogin);

// Shared
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', authenticate, controller.me);
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  controller.changePassword
);

module.exports = router;
