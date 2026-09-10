import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/authenticate';
import * as ctrl from '../controllers/misc.controller';

const router = Router();
router.use(authenticate);

router.get('/audit-logs', authorize(Role.SUPER_ADMIN), ctrl.listAuditLogs);
router.get('/notifications', ctrl.myNotifications);
router.patch('/notifications/:id/read', ctrl.markNotificationRead);
router.patch('/notifications/read-all', ctrl.markAllNotificationsRead);

export default router;
