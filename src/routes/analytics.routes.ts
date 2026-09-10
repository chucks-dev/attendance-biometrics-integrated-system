import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/authenticate';
import * as ctrl from '../controllers/analytics.controller';

const router = Router();
router.use(authenticate, authorize(Role.SUPER_ADMIN));

router.get('/stats', ctrl.getDashboardStats);
router.get('/trend', ctrl.getAttendanceTrend);
router.get('/department-performance', ctrl.getDepartmentPerformance);
router.get('/distribution', ctrl.getAttendanceDistribution);

export default router;
