const express = require('express');
const controller = require('../controllers/course.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  createCourseSchema,
  updateCourseSchema,
  assignLecturerSchema,
  courseQuerySchema,
  idParamSchema,
} = require('../validators/academic.validator');

const router = express.Router();
router.use(authenticate);

router.get('/', validate({ query: courseQuerySchema }), controller.list);
router.get('/available-for-student', authorize('STUDENT'), controller.listAvailableForStudent);
router.get('/my-assigned', authorize('LECTURER'), controller.listMyAssignedCourses);
router.get('/:id', validate({ params: idParamSchema }), controller.getOne);

router.post('/', authorize('SUPER_ADMIN'), validate({ body: createCourseSchema }), controller.create);
router.patch(
  '/:id',
  authorize('SUPER_ADMIN'),
  validate({ params: idParamSchema, body: updateCourseSchema }),
  controller.update
);
router.patch(
  '/:id/assign-lecturer',
  authorize('SUPER_ADMIN'),
  validate({ params: idParamSchema, body: assignLecturerSchema }),
  controller.assignLecturer
);
router.delete('/:id', authorize('SUPER_ADMIN'), validate({ params: idParamSchema }), controller.remove);

module.exports = router;
