import { Response } from 'express';
import { SessionStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/authenticate';
import { recordAudit } from '../services/audit.service';
import { rotateSessionQrToken } from '../services/qrAttendance.service';
import { notifyCourseStudents } from '../services/notification.service';

async function getLecturerIdForUser(userId: string) {
  const lecturer = await prisma.lecturer.findUnique({ where: { userId } });
  if (!lecturer) throw AppError.forbidden('Lecturer profile not found for this account');
  return lecturer.id;
}

export const createSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const lecturerId = await getLecturerIdForUser(req.user!.id);
  const { courseId, venue, date, startTime } = req.body as Record<string, string>;

  if (!courseId || !venue || !date || !startTime) {
    throw AppError.badRequest('courseId, venue, date, and startTime are required');
  }

  // Confirm the lecturer is actually assigned to this course
  const assignment = await prisma.course_assignments.findUnique({
    where: { courseId_lecturerId: { courseId, lecturerId } },
  });
  if (!assignment) throw AppError.forbidden('You are not assigned to this course');

  const session = await prisma.attendanceSession.create({
    data: {
      courseId,
      lecturerId,
      venue,
      date: new Date(date),
      startTime: new Date(startTime),
      status: SessionStatus.OPEN,
    },
    include: { course: true },
  });

  const { qrToken, qrExpiresAt } = await rotateSessionQrToken(session.id);

  await recordAudit({ userId: req.user!.id, action: 'SESSION_STARTED', category: 'ATTENDANCE', details: { sessionId: session.id }, ipAddress: req.ip });
  await notifyCourseStudents(courseId, 'SESSION_STARTED', `Attendance opened for ${session.course.courseCode}`, `${session.course.courseTitle} attendance is now open at ${venue}.`);

  res.status(201).json({ success: true, data: { ...session, qrToken, qrExpiresAt } });
});

export const refreshQrToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const lecturerId = await getLecturerIdForUser(req.user!.id);
  const session = await prisma.attendanceSession.findUnique({ where: { id } });
  if (!session) throw AppError.notFound('Session not found');
  if (session.lecturerId !== lecturerId) throw AppError.forbidden('You do not own this session');

  const result = await rotateSessionQrToken(session.id);
  res.json({ success: true, data: result });
});

export const closeSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const lecturerId = await getLecturerIdForUser(req.user!.id);
  const session = await prisma.attendanceSession.findUnique({ where: { id }, include: { course: true } });
  if (!session) throw AppError.notFound('Session not found');
  if (session.lecturerId !== lecturerId) throw AppError.forbidden('You do not own this session');

  const updated = await prisma.attendanceSession.update({
    where: { id: session.id },
    data: { status: SessionStatus.CLOSED, endTime: new Date(), qrToken: null, qrExpiresAt: null },
  });

  await recordAudit({ userId: req.user!.id, action: 'SESSION_CLOSED', category: 'ATTENDANCE', details: { sessionId: session.id }, ipAddress: req.ip });
  await notifyCourseStudents(session.courseId, 'SESSION_CLOSED', `Attendance closed for ${session.course.courseCode}`, `${session.course.courseTitle} attendance has closed.`);

  res.json({ success: true, data: updated });
});

export const listMySessions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const lecturerId = await getLecturerIdForUser(req.user!.id);
  const sessions = await prisma.attendanceSession.findMany({
    where: { lecturerId },
    include: {
  course: true,
  _count: {
    select: {
      attendance_records: true,
    },
  },
},
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: sessions });
});

export const getSessionMonitor = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const lecturerId = await getLecturerIdForUser(req.user!.id);
  const id = String(req.params.id);
  const session = await prisma.attendanceSession.findUnique({
    
    where: { id},
    include: {
      course: true,
      attendanceRecords: { include: { student: true }, orderBy: { recordedAt: 'desc' } },
    },
  });
  if (!session) throw AppError.notFound('Session not found');
  if (session.lecturerId !== lecturerId) throw AppError.forbidden('You do not own this session');

  res.json({ success: true, data: session });
});
