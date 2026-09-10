import { Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/authenticate';
import { getBiometricProvider } from '../services/biometric/BiometricProvider';
import { recordAudit } from '../services/audit.service';
import { BiometricType } from '@prisma/client';

export const enrollBiometric = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { studentId, biometricType, sample } = req.body as { studentId?: string; biometricType?: BiometricType; sample?: unknown };
  if (!studentId || !biometricType) throw AppError.badRequest('studentId and biometricType are required');
  if (!['FINGERPRINT', 'FACIAL'].includes(biometricType)) throw AppError.badRequest('Invalid biometricType');

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw AppError.notFound('Student not found');

  const provider = getBiometricProvider(biometricType);
  const result = await provider.enroll(studentId, sample);

 const record = await prisma.biometric_records.create({
  data: {
    id: crypto.randomUUID(),
    studentId,
    biometricType,
    updatedAt: new Date(),
  },
});

  await recordAudit({
    userId: req.user!.id,
    action: 'BIOMETRIC_ENROLLED',
    category: 'BIOMETRIC',
    details: { studentId, biometricType, success: result.success },
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, data: record, providerMessage: result.message });
});

export const listBiometricRecords = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { studentId, status } = req.query as { studentId?: string; status?: string };
  const records = await prisma.biometric_records.findMany({
    where: { ...(studentId && { studentId }), ...(status && { status: status as any }) },
    include: { students: true },
    orderBy: { enrolledAt: 'desc' },
  });
  res.json({ success: true, data: records });
});
