const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditLog.service');
const { notify } = require('../services/notification.service');

const listStudents = catchAsync(async (req, res) => {
  const { status, departmentId, search } = req.query;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.max(1, parseInt(req.query.pageSize, 10) || 20);

  const where = {
    role: 'STUDENT',

    ...(status && {
      isActive: status === 'ACTIVE',
    }),

    ...(departmentId && {
      student: { departmentId },
    }),

    ...(search && {
      OR: [
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          student: {
            fullName: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          student: {
            applicationNumber: {
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
    prisma.user.findMany({
      where,
      include: {
        student: {
          include: {
            department: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    }),

    prisma.user.count({ where }),
  ]);

  const sanitized = items.map(({ passwordHash, ...rest }) => rest);

  res.status(200).json({
    success: true,
    data: sanitized,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

const listLecturers = catchAsync(async (req, res) => {
  const { status, search } = req.query;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.max(1, parseInt(req.query.pageSize, 10) || 20);

  const where = {
    role: 'LECTURER',

    ...(status && {
      isActive: status === 'ACTIVE',
    }),

    ...(search && {
      OR: [
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lecturer: {
            fullName: {
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
    prisma.user.findMany({
      where,
      include: {
        lecturer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    }),

    prisma.user.count({ where }),
  ]);

  const sanitized = items.map(({ passwordHash, ...rest }) => rest);

  res.status(200).json({
    success: true,
    data: sanitized,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
    throw AppError.badRequest('Invalid account status');
  }

  const isActive = status === 'ACTIVE';

  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
  });

  await notify({
    userId: user.id,
    type: 'SYSTEM',
    title: 'Account Status Updated',
    message: `Your account status has been changed to ${status}.`,
  });

  await recordAudit({
    userId: req.user.id,
    action: 'USER_STATUS_UPDATED',
    entity: 'User',
    entityId: user.id,
    metadata: { status },
    req,
  });

  const { passwordHash, ...safe } = user;

  res.status(200).json({
    success: true,
    data: {
      ...safe,
      status: isActive ? 'ACTIVE' : 'SUSPENDED',
    },
  });
});

const deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  const target = await prisma.user.findUnique({
    where: { id },
  });

  if (!target) {
    throw AppError.notFound('User not found');
  }

  if (target.role === 'SUPER_ADMIN') {
    throw AppError.forbidden('Cannot delete an admin account');
  }

  await prisma.user.delete({
    where: { id },
  });

  await recordAudit({
    userId: req.user.id,
    action: 'USER_DELETED',
    entity: 'User',
    entityId: id,
    req,
  });

  res.status(204).send();
});

module.exports = {
  listStudents,
  listLecturers,
  updateUserStatus,
  deleteUser,
};