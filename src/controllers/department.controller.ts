import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/authenticate';
import { recordAudit } from '../services/audit.service';

export const listDepartments = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { students: true, lecturers: true, courses: true } } },
  });
  res.json({ success: true, data: departments });
});

export const getDepartment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) throw AppError.notFound('Department not found');
  res.json({ success: true, data: department });
});

export const createDepartment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, code } = req.body as { name?: string; code?: string };
  if (!name || !code) throw AppError.badRequest('name and code are required');

  const existing = await prisma.department.findFirst({ where: { OR: [{ name }, { code }] } });
  if (existing) throw AppError.conflict('A department with this name or code already exists');

  const department = await prisma.department.create({ data: { name, code: code.toUpperCase() } });
  await recordAudit({ userId: req.user!.id, action: 'DEPARTMENT_CREATED', category: 'ADMIN', details: { departmentId: department.id }, ipAddress: req.ip });
  res.status(201).json({ success: true, data: department });
});

export const updateDepartment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const { name, code } = req.body as { name?: string; code?: string };
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) throw AppError.notFound('Department not found');

  const updated = await prisma.department.update({
    where: { id },
    data: { ...(name && { name }), ...(code && { code: code.toUpperCase() }) },
  });
  await recordAudit({ userId: req.user!.id, action: 'DEPARTMENT_UPDATED', category: 'ADMIN', details: { departmentId: updated.id }, ipAddress: req.ip });
  res.json({ success: true, data: updated });
});

export const deleteDepartment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) throw AppError.notFound('Department not found');

  await prisma.department.delete({ where: { id } });
  await recordAudit({ userId: req.user!.id, action: 'DEPARTMENT_DELETED', category: 'ADMIN', details: { departmentId: req.params.id }, ipAddress: req.ip });
  res.json({ success: true, message: 'Department deleted' });
});
