const express = require('express');
const controller = require('../controllers/reports.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

// Student pulls their own report; admin/lecturer can view via query param variant.
router.get('/student', authorize('STUDENT'), controller.studentReport);
router.get('/student/:studentId', authorize('SUPER_ADMIN', 'LECTURER'), controller.studentReport);

router.get('/course/:courseId', authorize('SUPER_ADMIN', 'LECTURER'), controller.courseReport);

router.get('/lecturer', authorize('LECTURER'), controller.lecturerReport);
router.get('/lecturer/:lecturerId', authorize('SUPER_ADMIN'), controller.lecturerReport);

router.get('/department/:departmentId', authorize('SUPER_ADMIN'), controller.departmentReport);
router.get('/institutional', authorize('SUPER_ADMIN'), controller.institutionalReport);

module.exports = router;
