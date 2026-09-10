const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { generateQrToken, generateSessionToken, generateQrDataUrl } = require('./qr.service');
const { notify, notifyMany } = require('./notification.service');
const { recordAudit } = require('./auditLog.service');
const webauthnService = require('./webauthn.service');
const env = require('../config/env');

// ------------------------------------------------------------
// SESSION LIFECYCLE (lecturer)
// ------------------------------------------------------------

async function createSession(lecturerId, input, req) {
  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
if (!course) throw AppError.notFound('Course not found');

const assignment = await prisma.course_assignments.findUnique({
  where: {
    courseId_lecturerId: {
      courseId: input.courseId,
      lecturerId,
    },
  },
});

if (!assignment) {
  throw AppError.forbidden('You are not the assigned lecturer for this course');
}

  const qrCodeToken = generateQrToken();
  const sessionToken = generateSessionToken();

  const session = await prisma.attendanceSession.create({
    data: {
      courseId: input.courseId,
      lecturerId,
      venue: input.venue,
      date: new Date(input.date),
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
      status: 'OPEN',
      qrToken: qrCodeToken,
      sessionToken,
      requiredVerification: input.requiredVerification || 'QR_AND_FINGERPRINT',
    },
    include: { course: true },
  });

  const qrCodeDataUrl = await generateQrDataUrl(qrCodeToken, env.clientUrl);

  // Notify all students registered for this course.
  const registrations = await prisma.courseRegistration.findMany({
    where: { courseId: input.courseId },
    include: { student: { select: { userId: true } } },
  });
  await notifyMany(
    registrations.map((r) => r.student.userId),
    {
      type: 'SESSION_STARTED',
      title: 'Attendance Session Started',
      message: `Attendance is now open for ${course.courseCode} at ${input.venue}.`,
    }
  );

  await recordAudit({
    userId: req.user.id,
    action: 'ATTENDANCE_SESSION_CREATED',
    entity: 'AttendanceSession',
    entityId: session.id,
    metadata: { courseId: input.courseId },
    req,
  });

  return { ...session, qrCodeDataUrl };
}

async function closeSession(lecturerId, sessionId, req) {
  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId }, include: { course: true } });
  if (!session) throw AppError.notFound('Attendance session not found');
  if (session.lecturerId !== lecturerId) throw AppError.forbidden('Not your session to close');
  if (session.status === 'CLOSED') throw AppError.conflict('Session is already closed');

  const updated = await prisma.attendanceSession.update({ where: { id: sessionId }, data: { status: 'CLOSED' } });

  const registrations = await prisma.courseRegistration.findMany({
    where: { courseId: session.courseId },
    include: { student: { select: { userId: true } } },
  });
  await notifyMany(
    registrations.map((r) => r.student.userId),
    {
      type: 'SESSION_CLOSED',
      title: 'Attendance Session Closed',
      message: `Attendance has closed for ${session.course.courseCode}.`,
    }
  );

  await recordAudit({
    userId: req.user.id,
    action: 'ATTENDANCE_SESSION_CLOSED',
    entity: 'AttendanceSession',
    entityId: sessionId,
    req,
  });

  return updated;
}

async function regenerateQr(lecturerId, sessionId) {
  const session = await prisma.attendanceSession.findUnique({ where: { id: sessionId } });
  if (!session) throw AppError.notFound('Attendance session not found');
  if (session.lecturerId !== lecturerId) throw AppError.forbidden('Not your session');
  if (session.status !== 'OPEN') throw AppError.badRequest('Session is not open');

  const qrCodeToken = generateQrToken();
  const updated = await prisma.attendanceSession.update({ where: { id: sessionId }, data: { qrToken: qrCodeToken } });
  const qrCodeDataUrl = await generateQrDataUrl(qrCodeToken, env.clientUrl);
  return { ...updated, qrCodeDataUrl };
}

async function getActiveSessionsForStudent(studentId) {
  const registrations = await prisma.courseRegistration.findMany({
    where: { studentId },
    select: { courseId: true },
  });
  const courseIds = registrations.map((r) => r.courseId);

  return prisma.attendanceSession.findMany({
    where: { courseId: { in: courseIds }, status: 'OPEN' },
    include: { course: { select: { courseCode: true, courseTitle: true } } },
    orderBy: { startTime: 'desc' },
  });
}

async function listSessionsForCourse(lecturerId, courseId) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw AppError.notFound('Course not found');

  const assignment = await prisma.course_assignments.findUnique({
    where: {
      courseId_lecturerId: {
        courseId,
        lecturerId,
      },
    },
  });

  if (!assignment) throw AppError.forbidden('Not your course');

  return prisma.attendanceSession.findMany({
    where: { courseId },
    orderBy: { date: 'desc' },
    include: {
      course: true,
      _count: {
        select: {
          attendance_records: true,
        },
      },
    },
  });
}

// ------------------------------------------------------------
// VERIFICATION & RECORDING (student)
// ------------------------------------------------------------

const LATE_THRESHOLD_MINUTES = 15;

function determineStatus(session) {
  const minutesLate = (Date.now() - new Date(session.startTime).getTime()) / 60000;
  return minutesLate > LATE_THRESHOLD_MINUTES ? 'LATE' : 'PRESENT';
}

async function validateSessionForStudent(studentId, session) {
  if (!session) throw AppError.notFound('Attendance session not found or QR code is invalid');
  if (session.status !== 'OPEN') throw AppError.badRequest('This attendance session is closed');

  const registered = await prisma.courseRegistration.findFirst({
    where: { studentId, courseId: session.courseId },
  });
  if (!registered) throw AppError.forbidden('You are not registered for this course');

  const existingRecord = await prisma.attendanceRecord.findUnique({
    where: { sessionId_studentId: { sessionId: session.id, studentId } },
  });
  if (existingRecord) throw AppError.conflict('Attendance already recorded for this session');
}

/**
 * Step 1 of QR flow: student scans QR, client sends the token here.
 * If the session's requiredVerification is QR_CODE only, attendance
 * is recorded immediately. If QR_AND_FINGERPRINT, this only confirms
 * the QR is valid and returns the sessionToken the client needs to
 * pass into the fingerprint step next.
 */
async function scanQrCode(studentId, qrCodeToken, req) {
  const session = await prisma.attendanceSession.findUnique({ where: { qrToken: qrCodeToken  } });
  await validateSessionForStudent(studentId, session);

  if (session.requiredVerification === 'QR_CODE') {
    return recordAttendance(studentId, session, 'QR_CODE', req);
  }

  // QR_AND_FINGERPRINT: QR alone doesn't create the record yet.
  return {
    requiresFingerprint: true,
    sessionToken: session.sessionToken,
    course: undefined, // frontend already has course context from session lookup below if needed
    sessionId: session.id,
  };
}

/**
 * Step 2 (or standalone Method 2): after WebAuthn verification
 * succeeds, this actually writes the AttendanceRecord row.
 * `verificationMethod` reflects what was actually performed.
 */
async function recordAttendance(studentId, session, verificationMethod, req) {
  const status = determineStatus(session);

  const record = await prisma.attendanceRecord.create({
    data: {
      sessionId: session.id,
      studentId,
      verificationMethod,
      status,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    },
    include: { attendance_sessions: { include: { course: true } } },
  });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  await notify({
    userId: student.userId,
    type: 'ATTENDANCE_RECORDED',
    title: 'Attendance Recorded',
    message: `Your attendance for ${record.attendance_sessions.course.courseCode} was recorded as ${status}.`,
  });

  await recordAudit({
    userId: student.userId,
    action: 'ATTENDANCE_SIGNED',
    entity: 'AttendanceRecord',
    entityId: record.id,
    metadata: { verificationMethod, status },
    req,
  });

  return record;
}

/**
 * Fingerprint-only path (Method 2, mobile) — no QR involved.
 *
 * SECURITY: the WebAuthn assertion is verified INSIDE this function,
 * in the same call that records attendance. We never accept a bare
 * "trust me, fingerprint passed" flag from the client — that would
 * let anyone skip the biometric step by calling the API directly.
 * `webauthnResponse` is the raw assertion from navigator.credentials.get().
 */
async function signAttendanceViaFingerprint(studentId, userId, attendanceSessionId, webauthnResponse, req) {
  const session = await prisma.attendanceSession.findUnique({ where: { id: attendanceSessionId } });
  await validateSessionForStudent(studentId, session);

  // Throws if the assertion is invalid/forged/wrong device.
  await webauthnService.verifyAuthentication(userId, webauthnResponse);

  return recordAttendance(studentId, session, 'DEVICE_FINGERPRINT', req);
}

/**
 * Combined flow completion: after scanQrCode returned
 * requiresFingerprint + sessionToken, the client performs the
 * WebAuthn ceremony and this call verifies that assertion AND
 * records attendance atomically as QR_AND_FINGERPRINT.
 */
async function completeQrAndFingerprint(studentId, userId, sessionToken, webauthnResponse, req) {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionToken } });
  await validateSessionForStudent(studentId, session);

  await webauthnService.verifyAuthentication(userId, webauthnResponse);

  return recordAttendance(studentId, session, 'QR_AND_FINGERPRINT', req);
}

module.exports = {
  createSession,
  closeSession,
  regenerateQr,
  getActiveSessionsForStudent,
  listSessionsForCourse,
  scanQrCode,
  signAttendanceViaFingerprint,
  completeQrAndFingerprint,
};
