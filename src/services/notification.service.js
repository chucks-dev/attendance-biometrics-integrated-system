const prisma = require('../config/prisma');

async function notify({ userId, type, title, message }) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
    },
  });
}

async function notifyMany(userIds, { type, title, message }) {
  if (!userIds.length) return { count: 0 };

  return prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title,
      message,
    })),
  });
}

async function listForUser(
  userId,
  { unreadOnly = false, page = 1, pageSize = 20 } = {}
) {
  const where = {
    userId,
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),

    prisma.notification.count({
      where,
    }),

    prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    }),
  ]);

  return {
    items,
    total,
    unreadCount,
    page,
    pageSize,
  };
}

async function markRead(userId, notificationId) {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      isRead: true,
    },
  });
}

async function markAllRead(userId) {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });
}

module.exports = {
  notify,
  notifyMany,
  listForUser,
  markRead,
  markAllRead,
};