import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/authenticate';
import { recordAudit } from '../services/audit.service';

export const listCourses = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { search, departmentId, program, level, page = '1', pageSize = '20' } = req.query as Record<string, string>;

  const where: Prisma.CourseWhereInput = {
    ...(search && {
      OR: [
        { courseCode: { contains: search, mode: 'insensitive' } },
        { courseTitle: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(departmentId && { departmentId }),
    ...(program && { program: program as any }),
    ...(level && { level: level as any }),
  };

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: { department: true, assignments: { include: { lecturer: true } } },
      orderBy: { courseCode: 'asc' },
      take,
      skip,
    }),
    prisma.course.count({ where }),
  ]);

  res.json({ success: true, data: courses, meta: { total, page: Number(page), pageSize: take } });
});

export const createCourse = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { courseCode, courseTitle, creditUnit, departmentId, program, level, lecturerId } = req.body as Record<string, string>;

  if (!courseCode || !courseTitle || !creditUnit || !departmentId || !program || !level) {
    throw AppError.badRequest('courseCode, courseTitle, creditUnit, departmentId, program, and level are required');
  }

  const existing = await prisma.course.findUnique({ where: { courseCode } });
  if (existing) throw AppError.conflict('A course with this code already exists');

  const course = await prisma.course.create({
    data: {
      courseCode: courseCode.toUpperCase(),
      courseTitle,
      creditUnit: Number(creditUnit),
      departmentId,
      program: program as any,
      level: level as any,
      ...(lecturerId && { assignments: { create: { lecturerId } } }),
    },
    include: { department: true, assignments: { include: { lecturer: true } } },
  });

  await recordAudit({ userId: req.user!.id, action: 'COURSE_CREATED', category: 'ADMIN', details: { courseId: course.id }, ipAddress: req.ip });
  res.status(201).json({ success: true, data: course });
});

export const updateCourse = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw AppError.notFound('Course not found');

  const { courseCode, courseTitle, creditUnit, departmentId, program, level } = req.body as Record<string, string>;

  const updated = await prisma.course.update({
    where: { id },
    data: {
      ...(courseCode && { courseCode: courseCode.toUpperCase() }),
      ...(courseTitle && { courseTitle }),
      ...(creditUnit && { creditUnit: Number(creditUnit) }),
      ...(departmentId && { departmentId }),
      ...(program && { program: program as any }),
      ...(level && { level: level as any }),
    },
    include: { department: true, assignments: { include: { lecturer: true } } },
  });

  await recordAudit({ userId: req.user!.id, action: 'COURSE_UPDATED', category: 'ADMIN', details: { courseId: updated.id }, ipAddress: req.ip });
  res.json({ success: true, data: updated });
});

export const deleteCourse = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw AppError.notFound('Course not found');

  await prisma.course.delete({ where: { id } });
  await recordAudit({ userId: req.user!.id, action: 'COURSE_DELETED', category: 'ADMIN', details: { courseId: req.params.id }, ipAddress: req.ip });
  res.json({ success: true, message: 'Course deleted' });
});

export const assignLecturer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const { lecturerId } = req.body as { lecturerId?: string };
  if (!lecturerId) throw AppError.badRequest('lecturerId is required');

  const [course, lecturer] = await Promise.all([
    prisma.course.findUnique({ where: { id } }),
    prisma.lecturer.findUnique({ where: { id: lecturerId } }),
  ]);
  if (!course) throw AppError.notFound('Course not found');
  if (!lecturer) throw AppError.notFound('Lecturer not found');

  const assignment = await prisma.course_assignments.upsert({
    where: { courseId_lecturerId: { courseId: course.id, lecturerId } },
    create: {id: crypto.randomUUID(), courseId: course.id, lecturerId },
    update: {},
  });

  await recordAudit({ userId: req.user!.id, action: 'LECTURER_ASSIGNED', category: 'ADMIN', details: { courseId: course.id, lecturerId }, ipAddress: req.ip });
  res.status(201).json({ success: true, data: assignment });
});
