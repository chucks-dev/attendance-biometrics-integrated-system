import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/authenticate';

// ── AUDIT LOGS (admin) ──
export const listAuditLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { search, category, page = '1', pageSize = '30' } = req.query as Record<string, string>;

  const where: Prisma.AuditLogWhereInput = {
    ...(category && { category }),
    ...(search && { action: { contains: search, mode: 'insensitive' } }),
  };

  const take = Math.min(Number(pageSize) || 30, 200);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, include: { user: { select: { email: true, role: true } } },
      orderBy: { createdAt: 'desc' }, take, skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ success: true, data: logs, meta: { total, page: Number(page), pageSize: take } });
});

// ── NOTIFICATIONS (any authenticated user) ──
export const myNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, data: notifications });
});

export const markNotificationRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  await prisma.notification.updateMany({
    where: { id, userId: req.user!.id },
    data: { isRead: true },
  });
  res.json({ success: true });
});

export const markAllNotificationsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true },
  });
  res.json({ success: true });
});
