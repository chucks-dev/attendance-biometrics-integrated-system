import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { authLimiter } from '../middleware/rateLimiters';

const router = Router();

// Admin — no registration route exists on purpose; accounts are pre-created only.
router.post('/admin/login', authLimiter, authController.adminLogin);

// Lecturer
router.post('/lecturer/register', authLimiter, authController.lecturerRegister);
router.post('/lecturer/login', authLimiter, authController.lecturerLogin);

// Student
router.post('/student/register', authLimiter, authController.studentRegister);
router.post('/student/login', authLimiter, authController.studentLogin);

// Shared
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/change-password', authenticate, authController.changePassword);
router.get('/me', authenticate, authController.me);

export default router;
