const catchAsync = require('../utils/catchAsync');
const attendanceService = require('../services/attendance.service');
const webauthnService = require('../services/webauthn.service');

// ---- Lecturer: session lifecycle ----

const createSession = catchAsync(async (req, res) => {
  const session = await attendanceService.createSession(req.user.lecturerId, req.body, req);
  res.status(201).json({ success: true, data: session });
});

const closeSession = catchAsync(async (req, res) => {
  const session = await attendanceService.closeSession(req.user.lecturerId, req.params.id, req);
  res.status(200).json({ success: true, data: session });
});

const regenerateQr = catchAsync(async (req, res) => {
  const session = await attendanceService.regenerateQr(req.user.lecturerId, req.params.id);
  res.status(200).json({ success: true, data: session });
});

const listSessionsForCourse = catchAsync(async (req, res) => {
  const sessions = await attendanceService.listSessionsForCourse(req.user.lecturerId, req.params.courseId);
  res.status(200).json({ success: true, data: sessions });
});

// ---- Student: active sessions & verification ----

const activeSessions = catchAsync(async (req, res) => {
  const sessions = await attendanceService.getActiveSessionsForStudent(req.user.studentId);
  res.status(200).json({ success: true, data: sessions });
});

const scanQrCode = catchAsync(async (req, res) => {
  const result = await attendanceService.scanQrCode(req.user.studentId, req.body.qrCodeToken, req);
  res.status(200).json({ success: true, data: result });
});

// Fingerprint-only (Method 2, mobile). The client must first call
// GET /webauthn/authenticate/options to get a challenge, complete
// navigator.credentials.get() on-device, then send the resulting
// assertion here as `webauthnResponse` — verified server-side
// inside the same request that records attendance.
const signAttendanceViaFingerprint = catchAsync(async (req, res) => {
  const record = await attendanceService.signAttendanceViaFingerprint(
    req.user.studentId,
    req.user.id,
    req.body.attendanceSessionId,
    req.body.webauthnResponse,
    req
  );
  res.status(201).json({ success: true, data: record });
});

const completeQrAndFingerprint = catchAsync(async (req, res) => {
  const record = await attendanceService.completeQrAndFingerprint(
    req.user.studentId,
    req.user.id,
    req.body.sessionToken,
    req.body.webauthnResponse,
    req
  );
  res.status(201).json({ success: true, data: record });
});

module.exports = {
  createSession,
  closeSession,
  regenerateQr,
  listSessionsForCourse,
  activeSessions,
  scanQrCode,
  signAttendanceViaFingerprint,
  completeQrAndFingerprint,
};
