import { Router } from 'express';
import authRoutes from './auth.routes';
import departmentRoutes from './department.routes';
import courseRoutes from './course.routes';
import attendanceRoutes from './attendance.routes';
import analyticsRoutes from './analytics.routes';
import biometricRoutes from './biometric.routes';
import usersRoutes from './users.routes';
import miscRoutes from './misc.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, message: 'FPN Attendance API is running' }));

router.use('/auth', authRoutes);
router.use('/departments', departmentRoutes);
router.use('/courses', courseRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/biometrics', biometricRoutes);
router.use('/users', usersRoutes);
router.use('/', miscRoutes); // /audit-logs, /notifications

export default router;
