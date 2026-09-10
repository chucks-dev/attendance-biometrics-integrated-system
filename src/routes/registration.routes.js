const express = require('express');
const controller = require('../controllers/registration.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { registerCoursesSchema } = require('../validators/registration.validator');
const { z } = require('zod');

const router = express.Router();
router.use(authenticate, authorize('STUDENT'));

router.post('/', validate({ body: registerCoursesSchema }), controller.registerCourses);
router.get('/my', controller.myRegistrations);
router.delete(
  '/:courseId',
  validate({ params: z.object({ courseId: z.string().uuid() }) }),
  controller.unregisterCourse
);

module.exports = router;
