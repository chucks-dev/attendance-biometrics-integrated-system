import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/authenticate';

export const listAttendanceRecords = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    search, courseId, departmentId, status, method, dateFrom, dateTo,
    page = '1', pageSize = '25',
  } = req.query as Record<string, string>;

  const where: Prisma.AttendanceRecordWhereInput = {
    ...(status && { status: status as any }),
    ...(method && { verificationMethod: method as any }),
    ...(courseId && { session: { courseId } }),
    ...(departmentId && { student: { departmentId } }),
    ...(search && {
      student: {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { applicationNumber: { contains: search, mode: 'insensitive' } },
        ],
      },
    }),
    ...((dateFrom || dateTo) && {
      recordedAt: {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      },
    }),
  };

  const take = Math.min(Number(pageSize) || 25, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: { attendance_sessions: { include: { course: true } } },
      orderBy: { recordedAt: 'desc' },
      take,
      skip,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  res.json({ success: true, data: records, meta: { total, page: Number(page), pageSize: take } });
});

export const myAttendanceHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) throw AppError.forbidden('Student profile not found');

  const records = await prisma.attendanceRecord.findMany({
    where: { studentId: student.id },
    include: { attendance_sessions: { include: { course: true } } },
    orderBy: { recordedAt: 'desc' },
  });

  const totalSessions = await prisma.attendanceSession.count({
    where: { course: { registrations: { some: { studentId: student.id } } }, status: 'CLOSED' },
  });
  const attended = records.filter((r) => r.status !== 'ABSENT').length;
  const attendancePercentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;

  res.json({ success: true, data: { records, stats: { totalSessions, attended, attendancePercentage } } });
});
