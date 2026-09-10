import { randomBytes } from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { AttendanceStatus, SessionStatus, VerificationMethod } from '@prisma/client';

/**
 * QR fallback attendance: the lecturer's session screen displays a QR code
 * encoding a short-lived token that rotates every env.qr.rotateSeconds.
 * Students scan it with their own device (already authenticated as
 * themselves) to check in. This is a legitimate, separate verification
 * method (VerificationMethod.QR_FALLBACK) — it is never recorded as
 * FINGERPRINT or FACIAL, so the attendance trail always reflects how
 * identity was actually established.
 */

function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function rotateSessionQrToken(sessionId: string) {
  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
  if (!session) throw AppError.notFound('Attendance session not found');
  if (session.status !== SessionStatus.OPEN) {
    throw AppError.badRequest('Cannot generate QR token for a closed session');
  }

  const qrToken = generateToken();
  const qrExpiresAt = new Date(Date.now() + env.qr.rotateSeconds * 1000);

  await prisma.attendanceSession.update({
    where: { id: sessionId },
    data: { qrToken, qrExpiresAt },
  });

  return { qrToken, qrExpiresAt, rotateSeconds: env.qr.rotateSeconds };
}

function classifyStatus(session: { startTime: Date }, now: Date): AttendanceStatus {
  const lateThresholdMs = 15 * 60 * 1000; // 15 minutes after start = LATE
  const diff = now.getTime() - new Date(session.startTime).getTime();
  if (diff > lateThresholdMs) return AttendanceStatus.LATE;
  return AttendanceStatus.PRESENT;
}

export async function checkInWithQrToken(studentId: string, token: string) {
  const session = await prisma.attendanceSession.findFirst({
    where: { qrToken: token },
  });

  if (!session) throw AppError.badRequest('Invalid or expired QR code');
  if (session.status !== SessionStatus.OPEN) throw AppError.badRequest('This attendance session is closed');
  if (!session.qrExpiresAt || session.qrExpiresAt < new Date()) {
    throw AppError.badRequest('This QR code has expired — ask the lecturer to refresh it');
  }

  const existing = await prisma.attendanceRecord.findUnique({
    where: { sessionId_studentId: { sessionId: session.id, studentId } },
  });
  if (existing) throw AppError.conflict('Attendance already recorded for this session');

  const status = classifyStatus(session, new Date());

  const record = await prisma.attendanceRecord.create({
    data: {
      sessionId: session.id,
      studentId,
      status,
      verificationMethod: VerificationMethod.QR_FALLBACK,
    },
    include: { attendance_sessions: { include: { course: true } } },
  });

  return record;
}
