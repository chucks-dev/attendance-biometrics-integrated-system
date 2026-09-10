const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/departments', require('./department.routes'));
router.use('/academic-sessions', require('./academicSession.routes'));
router.use('/courses', require('./course.routes'));
router.use('/registrations', require('./registration.routes'));
router.use('/attendance', require('./attendance.routes'));
router.use('/attendance-records', require('./attendanceRecord.routes'));
router.use('/webauthn', require('./webauthn.routes'));
router.use('/users', require('./user.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/audit-logs', require('./auditLog.routes'));
router.use('/analytics', require('./analytics.routes'));
router.use('/reports', require('./reports.routes'));

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'FPN Attendance API is running', timestamp: new Date().toISOString() });
});

module.exports = router;
