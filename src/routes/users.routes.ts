import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/authenticate';
import * as ctrl from '../controllers/userManagement.controller';

const router = Router();
router.use(authenticate);

// Admin views
router.get('/students', authorize(Role.SUPER_ADMIN), ctrl.listStudents);
router.patch('/students/:id/toggle-active', authorize(Role.SUPER_ADMIN), ctrl.toggleStudentActive);
router.get('/lecturers', authorize(Role.SUPER_ADMIN), ctrl.listLecturers);
router.patch('/lecturers/:id/toggle-active', authorize(Role.SUPER_ADMIN), ctrl.toggleLecturerActive);

// Student self-service
router.post('/students/me/register-course', authorize(Role.STUDENT), ctrl.registerForCourse);
router.get('/students/me/courses', authorize(Role.STUDENT), ctrl.myCourses);

// Lecturer self-service
router.get('/lecturers/me/courses', authorize(Role.LECTURER), ctrl.myAssignedCourses);

export default router;
