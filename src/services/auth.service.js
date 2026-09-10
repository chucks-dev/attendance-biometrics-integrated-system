const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { hashPassword, comparePassword } = require('../utils/password');
const {
  signAccessToken,
  generateRefreshToken,
  refreshExpiryDate,
} = require('../utils/jwt');
const { recordAudit } = require('./auditLog.service');

/**
 * Issues a fresh access + refresh token pair for a user and persists
 * the refresh token's hash. Called on login and on refresh rotation.
 */
async function issueTokenPair(user, req) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const rawRefreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: rawRefreshToken,
      expiresAt: refreshExpiryDate(),
    },
  });

  return { accessToken, refreshToken: rawRefreshToken };
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ------------------------------------------------------------
// ADMIN
// ------------------------------------------------------------

async function loginAdmin({ email, password }, req) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw AppError.unauthorized('Invalid credentials');
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw AppError.unauthorized('Invalid credentials');
  if (!user.isActive) throw AppError.forbidden('Account is not active');

  const tokens = await issueTokenPair(user, req);
  await recordAudit({ userId: user.id, action: 'LOGIN_ADMIN', entity: 'User', entityId: user.id, req });

  return { user: sanitizeUser(user), ...tokens };
}

// ------------------------------------------------------------
// LECTURER
// ------------------------------------------------------------

async function registerLecturer(input, req) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict('An account with this email already exists');

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: 'LECTURER',
      isActive: true,
      lecturer: {
        create: {
          fullName: input.fullName,
          phoneNumber: input.phoneNumber,
          gender: input.gender,
        },
      },
    },
    include: { lecturer: true },
  });

  await recordAudit({ userId: user.id, action: 'REGISTER_LECTURER', entity: 'User', entityId: user.id, req });

  return sanitizeUser(user);
}

async function loginLecturer({ email, password }, req) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { lecturer: true },
  });
  if (!user || user.role !== 'LECTURER') throw AppError.unauthorized('Invalid credentials');

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw AppError.unauthorized('Invalid credentials');
  if (!user.isActive) {
    throw AppError.forbidden('Your account is pending approval or has been suspended');
  }

  const tokens = await issueTokenPair(user, req);
  await recordAudit({ userId: user.id, action: 'LOGIN_LECTURER', entity: 'User', entityId: user.id, req });

  return { user: sanitizeUser(user), ...tokens };
}

// ------------------------------------------------------------
// STUDENT
// ------------------------------------------------------------

async function registerStudent(input, req) {
  const [existingEmail, existingAppNo, department] = await Promise.all([
    prisma.user.findUnique({ where: { email: input.email } }),
    prisma.student.findUnique({ where: { applicationNumber: input.applicationNumber } }),
    prisma.department.findUnique({ where: { id: input.departmentId } }),
  ]);

  if (existingEmail) throw AppError.conflict('An account with this email already exists');
  if (existingAppNo) throw AppError.conflict('An account with this application number already exists');
  if (!department) throw AppError.badRequest('Selected department does not exist');

  // Application number must encode the same program as selected —
  // e.g. FPN/NDM/... must match program=NDM.
  const programInAppNumber = input.applicationNumber.split('/')[1];
  if (programInAppNumber !== input.program) {
    throw AppError.badRequest('Application number program does not match selected program');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: 'STUDENT',
      isActive: true,
      student: {
        create: {
          fullName: input.fullName,
          phoneNumber: input.phoneNumber,
          gender: input.gender,
          applicationNumber: input.applicationNumber,
          departmentId: input.departmentId,
          program: input.program,
          level: input.level,
        },
      },
    },
    include: { student: true },
  });

  await recordAudit({ userId: user.id, action: 'REGISTER_STUDENT', entity: 'User', entityId: user.id, req });

  return sanitizeUser(user);
}

async function loginStudent({ applicationNumber, password }, req) {
  const student = await prisma.student.findUnique({
    where: { applicationNumber },
    include: { user: true },
  });
  if (!student) throw AppError.unauthorized('Invalid credentials');

  const user = student.user;
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw AppError.unauthorized('Invalid credentials');
  if (!user.isActive) throw AppError.forbidden('Account is not active');

  const tokens = await issueTokenPair(user, req);
  await recordAudit({ userId: user.id, action: 'LOGIN_STUDENT', entity: 'User', entityId: user.id, req });

  return { user: sanitizeUser({ ...user, student }), ...tokens };
}

// ------------------------------------------------------------
// SHARED: refresh / logout / change password
// ------------------------------------------------------------

async function refreshTokens(rawRefreshToken, req) {
  if (!rawRefreshToken) {
    throw AppError.unauthorized('Refresh token missing');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: rawRefreshToken },
    include: { user: true },
  });

  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw AppError.unauthorized('Refresh token invalid or expired');
  }

  if (!stored.user.isActive) {
    throw AppError.forbidden('Account is not active');
  }

  // Rotate: revoke the used token, issue a new pair.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true },
  });

  const tokens = await issueTokenPair(stored.user, req);

  return tokens;
}

async function logout(rawRefreshToken) {
  if (!rawRefreshToken) return;

  await prisma.refreshToken.updateMany({
    where: { token: rawRefreshToken },
    data: { revoked: true },
  });
}

async function changePassword(userId, { currentPassword, newPassword }, req) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User not found');

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw AppError.unauthorized('Current password is incorrect');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });

  // Revoke all existing refresh tokens on password change.
  await prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });

  await recordAudit({ userId, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId, req });
}

module.exports = {
  loginAdmin,
  registerLecturer,
  loginLecturer,
  registerStudent,
  loginStudent,
  refreshTokens,
  logout,
  changePassword,
  sanitizeUser,
};
