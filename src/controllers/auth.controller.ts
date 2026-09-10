import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../middleware/errorHandler';
import { comparePassword, hashPassword, isPasswordStrong } from '../utils/password';
import { isValidApplicationNumber } from '../utils/applicationNumber';
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken, signAccessToken } from '../services/token.service';
import { recordAudit } from '../services/audit.service';
import { AuthenticatedRequest } from '../middleware/authenticate';

function sanitizeUser(user: { id: string; email: string; role: Role; mustChangePassword: boolean }) {
  return { id: user.id, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword };
}

// ── ADMIN LOGIN — /admin-secure-login only, no registration endpoint exists ──
export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) throw AppError.badRequest('Email and password are required');

  const user = await prisma.user.findUnique({
  where: { email },
  include: { admins: true },
});
  if (!user || user.role !== Role.SUPER_ADMIN || !user.admins) {
    throw AppError.unauthorized('Invalid credentials');
  }
  if (!user.isActive) throw AppError.forbidden('This account has been deactivated');

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    await recordAudit({ userId: user.id, action: 'LOGIN_FAILED', category: 'AUTH', ipAddress: req.ip });
    throw AppError.unauthorized('Invalid credentials');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);
  await recordAudit({ userId: user.id, action: 'LOGIN_SUCCESS', category: 'AUTH', ipAddress: req.ip });

  res.json({
    success: true,
    data: { user: sanitizeUser(user), admin: { fullName: user.admins.fullName }, accessToken, refreshToken },
  });
});

// ── LECTURER REGISTRATION ──
export const lecturerRegister = asyncHandler(async (req: Request, res: Response) => {
  const { fullName, email, phoneNumber, gender, password, confirmPassword } = req.body as Record<string, string>;

  if (!fullName || !email || !phoneNumber || !gender || !password || !confirmPassword) {
    throw AppError.badRequest('All fields are required');
  }
  if (password !== confirmPassword) throw AppError.badRequest('Passwords do not match');
  if (!isPasswordStrong(password)) {
    throw AppError.badRequest('Password must be at least 8 characters and include a letter and a number');
  }
  if (!['MALE', 'FEMALE'].includes(gender)) throw AppError.badRequest('Invalid gender');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw AppError.conflict('An account with this email already exists');

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: Role.LECTURER,
      lecturer: { create: { fullName, phoneNumber, gender: gender as any } },
    },
    include: { lecturer: true },
  });

  await recordAudit({ userId: user.id, action: 'LECTURER_REGISTERED', category: 'AUTH', ipAddress: req.ip });

  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);

  res.status(201).json({
    success: true,
    data: { user: sanitizeUser(user), lecturer: user.lecturer, accessToken, refreshToken },
  });
});

// ── LECTURER LOGIN ──
export const lecturerLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) throw AppError.badRequest('Email and password are required');

  const user = await prisma.user.findUnique({ where: { email }, include: { lecturer: true } });
  if (!user || user.role !== Role.LECTURER || !user.lecturer) throw AppError.unauthorized('Invalid credentials');
  if (!user.isActive) throw AppError.forbidden('This account has been deactivated');

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    await recordAudit({ userId: user.id, action: 'LOGIN_FAILED', category: 'AUTH', ipAddress: req.ip });
    throw AppError.unauthorized('Invalid credentials');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);
  await recordAudit({ userId: user.id, action: 'LOGIN_SUCCESS', category: 'AUTH', ipAddress: req.ip });

  res.json({ success: true, data: { user: sanitizeUser(user), lecturer: user.lecturer, accessToken, refreshToken } });
});

// ── STUDENT REGISTRATION ──
export const studentRegister = asyncHandler(async (req: Request, res: Response) => {
  const {
    fullName, email, phoneNumber, gender, departmentId, program, level,
    applicationNumber, password, confirmPassword,
  } = req.body as Record<string, string>;

  const required = { fullName, email, phoneNumber, gender, departmentId, program, level, applicationNumber, password, confirmPassword };
  for (const [key, value] of Object.entries(required)) {
    if (!value) throw AppError.badRequest(`${key} is required`);
  }
  if (password !== confirmPassword) throw AppError.badRequest('Passwords do not match');
  if (!isPasswordStrong(password)) {
    throw AppError.badRequest('Password must be at least 8 characters and include a letter and a number');
  }
  if (!isValidApplicationNumber(applicationNumber)) {
    throw AppError.badRequest('Application number must match the format FPN/PROGRAM/YEAR/NUMBER, e.g. FPN/NDM/2024/0000000001234');
  }
  if (!['NDE', 'NDM', 'HND'].includes(program)) throw AppError.badRequest('Invalid program');
  if (!['NDE1', 'NDE2', 'ND1', 'ND2', 'HND1', 'HND2'].includes(level)) throw AppError.badRequest('Invalid level');

  const [existingEmail, existingAppNo, department] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.student.findUnique({ where: { applicationNumber } }),
    prisma.department.findUnique({ where: { id: departmentId } }),
  ]);
  if (existingEmail) throw AppError.conflict('An account with this email already exists');
  if (existingAppNo) throw AppError.conflict('An account with this application number already exists');
  if (!department) throw AppError.badRequest('Selected department does not exist');

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: Role.STUDENT,
      student: {
        create: {
          fullName, phoneNumber, gender: gender as any, applicationNumber,
          departmentId, program: program as any, level: level as any,
        },
      },
    },
    include: { student: true },
  });

  await recordAudit({ userId: user.id, action: 'STUDENT_REGISTERED', category: 'AUTH', ipAddress: req.ip });

  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);

  res.status(201).json({
    success: true,
    data: { user: sanitizeUser(user), student: user.student, accessToken, refreshToken },
  });
});

// ── STUDENT LOGIN (by application number) ──
export const studentLogin = asyncHandler(async (req: Request, res: Response) => {
  const { applicationNumber, password } = req.body as { applicationNumber?: string; password?: string };
  if (!applicationNumber || !password) throw AppError.badRequest('Application number and password are required');

  const student = await prisma.student.findUnique({ where: { applicationNumber }, include: { user: true } });
  if (!student) throw AppError.unauthorized('Invalid credentials');
  const user = student.user;
  if (!user.isActive) throw AppError.forbidden('This account has been deactivated');

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    await recordAudit({ userId: user.id, action: 'LOGIN_FAILED', category: 'AUTH', ipAddress: req.ip });
    throw AppError.unauthorized('Invalid credentials');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);
  await recordAudit({ userId: user.id, action: 'LOGIN_SUCCESS', category: 'AUTH', ipAddress: req.ip });

  res.json({ success: true, data: { user: sanitizeUser(user), student, accessToken, refreshToken } });
});

// ── REFRESH ──
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) throw AppError.badRequest('refreshToken is required');

  const result = await rotateRefreshToken(refreshToken);
  if (!result) throw AppError.unauthorized('Invalid or expired refresh token');

  const accessToken = signAccessToken({ sub: result.user.id, role: result.user.role, email: result.user.email });
  res.json({ success: true, data: { accessToken, refreshToken: result.refreshToken } });
});

// ── LOGOUT ──
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) await revokeRefreshToken(refreshToken);
  res.json({ success: true, message: 'Logged out successfully' });
});

// ── CHANGE PASSWORD (also clears mustChangePassword flag) ──
export const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) throw AppError.badRequest('currentPassword and newPassword are required');
  if (!isPasswordStrong(newPassword)) {
    throw AppError.badRequest('New password must be at least 8 characters and include a letter and a number');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User not found');

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw AppError.unauthorized('Current password is incorrect');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
  await recordAudit({ userId, action: 'PASSWORD_CHANGED', category: 'AUTH', ipAddress: req.ip });

  res.json({ success: true, message: 'Password changed successfully' });
});

// ── ME ──
export const me = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      admins: true,
      lecturer: true,
      student: {
        include: {
          department: true,
        },
      },
    },
  });

  if (!user) {
    throw AppError.notFound('User not found');
  }

  const responseUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,

    studentId: user.student?.id ?? null,
    lecturerId: user.lecturer?.id ?? null,

    fullName: user.student?.fullName ?? user.lecturer?.fullName ?? user.admins?.fullName ?? null,
    applicationNumber: user.student?.applicationNumber ?? null,
    phoneNumber: user.student?.phoneNumber ?? user.lecturer?.phoneNumber ?? null,

    department: user.student?.department
      ? {
          id: user.student.department.id,
          name: user.student.department.name,
          code: user.student.department.code,
        }
      : null,

    program: user.student?.program ?? null,
    level: user.student?.level ?? null,

    lecturer: user.lecturer ?? null,
    admin: user.admins ?? null,
  };

  res.json({
    success: true,
    data: {
      user: responseUser,
    },
  });
});