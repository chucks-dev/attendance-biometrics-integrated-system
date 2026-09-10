import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/authenticate';
import * as ctrl from '../controllers/biometric.controller';

const router = Router();
router.use(authenticate, authorize(Role.SUPER_ADMIN));

router.post('/enroll', ctrl.enrollBiometric);
router.get('/', ctrl.listBiometricRecords);

export default router;
