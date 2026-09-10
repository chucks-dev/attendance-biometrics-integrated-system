const express = require('express');
const controller = require('../controllers/attendance.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  createSessionSchema,
  scanQrSchema,
  fingerprintSignSchema,
  completeCombinedSchema,
  idParamSchema,
  courseIdParamSchema,
} = require('../validators/attendance.validator');

const router = express.Router();
router.use(authenticate);

// Lecturer: session lifecycle
router.post('/sessions', authorize('LECTURER'), validate({ body: createSessionSchema }), controller.createSession);
router.patch(
  '/sessions/:id/close',
  authorize('LECTURER'),
  validate({ params: idParamSchema }),
  controller.closeSession
);
router.patch(
  '/sessions/:id/regenerate-qr',
  authorize('LECTURER'),
  validate({ params: idParamSchema }),
  controller.regenerateQr
);
router.get(
  '/sessions/course/:courseId',
  authorize('LECTURER'),
  validate({ params: courseIdParamSchema }),
  controller.listSessionsForCourse
);

// Student: verification
router.get('/sessions/active', authorize('STUDENT'), controller.activeSessions);
router.post('/scan-qr', authorize('STUDENT'), validate({ body: scanQrSchema }), controller.scanQrCode);
router.post(
  '/sign-fingerprint',
  authorize('STUDENT'),
  validate({ body: fingerprintSignSchema }),
  controller.signAttendanceViaFingerprint
);
router.post(
  '/complete-combined',
  authorize('STUDENT'),
  validate({ body: completeCombinedSchema }),
  controller.completeQrAndFingerprint
);

module.exports = router;
