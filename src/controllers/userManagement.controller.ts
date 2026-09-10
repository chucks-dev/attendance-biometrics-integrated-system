import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/authenticate';
import { recordAudit } from '../services/audit.service';

// ── STUDENTS (admin) ──
export const listStudents = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { search, departmentId, program, level, page = '1', pageSize = '25' } = req.query as Record<string, string>;

  const where: Prisma.StudentWhereInput = {
    ...(departmentId && { departmentId }),
    ...(program && { program: program as any }),
    ...(level && { level: level as any }),
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { applicationNumber: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const take = Math.min(Number(pageSize) || 25, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where, include: { department: true, user: { select: { email: true, isActive: true, lastLoginAt: true } } },
      orderBy: { fullName: 'asc' }, take, skip,
    }),
    prisma.student.count({ where }),
  ]);

  res.json({ success: true, data: students, meta: { total, page: Number(page), pageSize: take } });
});

export const toggleStudentActive = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const student = await prisma.student.findUnique({ where: { id }, include: { user: true } });
  if (!student) throw AppError.notFound('Student not found');

  const updated = await prisma.user.update({ where: { id: student.userId }, data: { isActive: !student.user.isActive } });
  await recordAudit({ userId: req.user!.id, action: 'STUDENT_STATUS_TOGGLED', category: 'ADMIN', details: { studentId: student.id, isActive: updated.isActive }, ipAddress: req.ip });
  res.json({ success: true, data: { isActive: updated.isActive } });
});

// ── LECTURERS (admin) ──
export const listLecturers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { search, departmentId, page = '1', pageSize = '25' } = req.query as Record<string, string>;

  const where: Prisma.LecturerWhereInput = {
    ...(departmentId && { departmentId }),
    ...(search && { fullName: { contains: search, mode: 'insensitive' } }),
  };

  const take = Math.min(Number(pageSize) || 25, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [lecturers, total] = await Promise.all([
    prisma.lecturer.findMany({
      where, include: { department: true, user: { select: { email: true, isActive: true, lastLoginAt: true } }, courseAssignments: { include: { course: true } } },
      orderBy: { fullName: 'asc' }, take, skip,
    }),
    prisma.lecturer.count({ where }),
  ]);

  res.json({ success: true, data: lecturers, meta: { total, page: Number(page), pageSize: take } });
});

export const toggleLecturerActive = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const lecturer = await prisma.lecturer.findUnique({ where: { id }, include: { user: true } });
  if (!lecturer) throw AppError.notFound('Lecturer not found');

  const updated = await prisma.user.update({ where: { id: lecturer.userId }, data: { isActive: !lecturer.user.isActive } });
  await recordAudit({ userId: req.user!.id, action: 'LECTURER_STATUS_TOGGLED', category: 'ADMIN', details: { lecturerId: lecturer.id, isActive: updated.isActive }, ipAddress: req.ip });
  res.json({ success: true, data: { isActive: updated.isActive } });
});

// ── Course registration (student self-service or admin) ──
export const registerForCourse = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) throw AppError.forbidden('Student profile not found');

  const { courseId } = req.body as { courseId?: string };
  if (!courseId) throw AppError.badRequest('courseId is required');

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw AppError.notFound('Course not found');

  const registration = await prisma.courseRegistration.upsert({
    where: { studentId_courseId: { studentId: student.id, courseId } },
    create: { studentId: student.id, courseId },
    update: {},
  });

  res.status(201).json({ success: true, data: registration });
});

export const myCourses = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) throw AppError.forbidden('Student profile not found');

  const registrations = await prisma.courseRegistration.findMany({
    where: { studentId: student.id },
    include: { course: { include: { course_assignments: { include: { lecturers: true } } } } },
  });

  res.json({ success: true, data: registrations.map((r) => r.course) });
});

export const myAssignedCourses = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const lecturer = await prisma.lecturer.findUnique({ where: { id } });
  if (!lecturer) throw AppError.forbidden('Lecturer profile not found');

  const assignments = await prisma.course_assignments.findMany({
    where: { lecturerId: lecturer.id },
    include: { courses: { include: { department: true } } },
  });

  res.json({ success: true, data: assignments.map((a) => a.courses) });
});
