import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

interface AuditInput {
  userId?: string | null;
  action: string;
  category: 'AUTH' | 'ATTENDANCE' | 'ADMIN' | 'BIOMETRIC' | 'PROFILE';
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function recordAudit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      category: input.category,
      details: input.details ? (input.details as Prisma.InputJsonValue) : undefined,
      ipAddress: input.ipAddress,
    },
  });
}
