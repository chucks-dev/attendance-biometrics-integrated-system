import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/authenticate';
import { checkInWithQrToken } from '../services/qrAttendance.service';
import { getBiometricProvider } from '../services/biometric/BiometricProvider';
import { recordAudit } from '../services/audit.service';
import { notifyUser } from '../services/notification.service';
import { AttendanceStatus, BiometricType, VerificationMethod } from '@prisma/client';

async function getStudentIdForUser(userId: string) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) throw AppError.forbidden('Student profile not found for this account');
  return student;
}

// ── QR fallback check-in — fully functional today ──
export const checkInWithQr = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const student = await getStudentIdForUser(req.user!.id);
  const { token } = req.body as { token?: string };
  if (!token) throw AppError.badRequest('QR token is required');

  const record = await checkInWithQrToken(student.id, token);

  await recordAudit({
    userId: req.user!.id,
    action: 'ATTENDANCE_MARKED_QR',
    category: 'ATTENDANCE',
    details: { sessionId: record.sessionId, status: record.status },
    ipAddress: req.ip,
  });

  const attendanceSession = await prisma.attendanceSession.findUnique({
  where: { id: record.sessionId },
  include: { course: true },
});

await notifyUser(
  req.user!.id,
  'ATTENDANCE_RECORDED',
  'Attendance recorded',
  `You were marked ${record.status} for ${attendanceSession?.course.courseCode ?? 'your course'}.`
);

  res.status(201).json({ success: true, data: record });
});

// ── Biometric check-in — wired to the abstraction layer; returns a clear
//    "not configured" response until a real SDK is registered. This keeps
//    the endpoint, route, and request contract stable for when hardware
//    integration lands, without pretending verification is happening now. ──
export const checkInWithBiometric = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const student = await getStudentIdForUser(req.user!.id);
  const { sessionId, biometricType, sample } = req.body as { sessionId?: string; biometricType?: BiometricType; sample?: unknown };

  if (!sessionId || !biometricType) throw AppError.badRequest('sessionId and biometricType are required');
  if (!['FINGERPRINT', 'FACIAL'].includes(biometricType)) throw AppError.badRequest('Invalid biometricType');

  const provider = getBiometricProvider(biometricType);
  const result = await provider.verify(student.id, sample);

  if (!result.success) {
    throw AppError.badRequest(result.message, { fallback: 'Use QR fallback check-in instead.' });
  }

  // Reachable only once a real provider is registered and returns success.
  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId }, include: { course: true } });
  if (!session) throw AppError.notFound('Session not found');

  const record = await prisma.attendanceRecord.create({
    data: {
      sessionId,
      studentId: student.id,
      status: AttendanceStatus.PRESENT,
      verificationMethod: biometricType === 'FINGERPRINT' ? VerificationMethod.FINGERPRINT : VerificationMethod.FACIAL,
    },
  });

  await recordAudit({ userId: req.user!.id, action: 'ATTENDANCE_MARKED_BIOMETRIC', category: 'ATTENDANCE', details: { sessionId }, ipAddress: req.ip });
  res.status(201).json({ success: true, data: record });
});

// ── Lecturer manual override (e.g. hardware failure, documented exception) ──
export const manualOverride = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const lecturer = await prisma.lecturer.findUnique({ where: { userId: req.user!.id } });
  if (!lecturer) throw AppError.forbidden('Lecturer profile not found');

  const { sessionId, studentId, status } = req.body as { sessionId?: string; studentId?: string; status?: AttendanceStatus };
  if (!sessionId || !studentId || !status) throw AppError.badRequest('sessionId, studentId, and status are required');

  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
  if (!session) throw AppError.notFound('Session not found');
  if (session.lecturerId !== lecturer.id) throw AppError.forbidden('You do not own this session');

  const record = await prisma.attendanceRecord.upsert({
    where: { sessionId_studentId: { sessionId, studentId } },
    create: { sessionId, studentId, status, verificationMethod: VerificationMethod.MANUAL_OVERRIDE },
    update: { status, verificationMethod: VerificationMethod.MANUAL_OVERRIDE },
  });

  await recordAudit({ userId: req.user!.id, action: 'ATTENDANCE_MANUAL_OVERRIDE', category: 'ATTENDANCE', details: { sessionId, studentId, status }, ipAddress: req.ip });
  res.json({ success: true, data: record });
});
