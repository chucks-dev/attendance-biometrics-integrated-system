import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/authenticate';
import * as ctrl from '../controllers/department.controller';

const router = Router();

// Public: the student registration form needs to populate a department dropdown
// before the applicant has an account. This route intentionally returns only
// non-sensitive fields (name, code) — see department.controller.listDepartments.
router.get('/', ctrl.listDepartments);
router.get('/:id', ctrl.getDepartment);

router.post('/', authenticate, authorize(Role.SUPER_ADMIN), ctrl.createDepartment);
router.put('/:id', authenticate, authorize(Role.SUPER_ADMIN), ctrl.updateDepartment);
router.delete('/:id', authenticate, authorize(Role.SUPER_ADMIN), ctrl.deleteDepartment);

export default router;
