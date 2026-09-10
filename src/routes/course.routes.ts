import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/authenticate';
import * as ctrl from '../controllers/course.controller';

const router = Router();

router.use(authenticate);
router.get('/', ctrl.listCourses);
router.post('/', authorize(Role.SUPER_ADMIN), ctrl.createCourse);
router.put('/:id', authorize(Role.SUPER_ADMIN), ctrl.updateCourse);
router.delete('/:id', authorize(Role.SUPER_ADMIN), ctrl.deleteCourse);
router.post('/:id/assign-lecturer', authorize(Role.SUPER_ADMIN), ctrl.assignLecturer);

export default router;
