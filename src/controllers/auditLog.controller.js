const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');

const list = catchAsync(async (req, res) => {
  const {
    action,
    userId,
    entity,
    dateFrom,
    dateTo,
    search,
  } = req.query;

  // Convert query-string pagination values to numbers
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.max(1, parseInt(req.query.pageSize, 10) || 30);

  const where = {
    ...(action && { action }),
    ...(userId && { userId }),
    ...(entity && { entity }),

    ...((dateFrom || dateTo) && {
      createdAt: {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      },
    }),

    ...(search && {
      OR: [
        {
          action: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          entity: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          user: {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ],
    }),
  };

  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    }),

    prisma.auditLog.count({
      where,
    }),
  ]);

  res.status(200).json({
    success: true,
    data: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

module.exports = { list };