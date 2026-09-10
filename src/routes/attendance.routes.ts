import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/authenticate';
import * as sessionCtrl from '../controllers/attendanceSession.controller';
import * as captureCtrl from '../controllers/attendanceCapture.controller';
import * as recordsCtrl from '../controllers/attendanceRecords.controller';

const router = Router();
router.use(authenticate);

// Sessions — lecturer
router.post('/sessions', authorize(Role.LECTURER), sessionCtrl.createSession);
router.get('/sessions/mine', authorize(Role.LECTURER), sessionCtrl.listMySessions);
router.get('/sessions/:id/monitor', authorize(Role.LECTURER), sessionCtrl.getSessionMonitor);
router.post('/sessions/:id/refresh-qr', authorize(Role.LECTURER), sessionCtrl.refreshQrToken);
router.post('/sessions/:id/close', authorize(Role.LECTURER), sessionCtrl.closeSession);
router.post('/manual-override', authorize(Role.LECTURER), captureCtrl.manualOverride);

// Capture — student
router.post('/check-in/qr', authorize(Role.STUDENT), captureCtrl.checkInWithQr);
router.post('/check-in/biometric', authorize(Role.STUDENT), captureCtrl.checkInWithBiometric);

// Records — admin views all, student views own
router.get('/records', authorize(Role.SUPER_ADMIN, Role.LECTURER), recordsCtrl.listAttendanceRecords);
router.get('/records/mine', authorize(Role.STUDENT), recordsCtrl.myAttendanceHistory);

export default router;
