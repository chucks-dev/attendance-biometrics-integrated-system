const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditLog.service');

const list = catchAsync(async (req, res) => {
  const { search } = req.query;
  const departments = await prisma.department.findMany({
    where: search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }] }
      : undefined,
    orderBy: { name: 'asc' },
    include: { _count: { select: { students: true, courses: true } } },
  });
  res.status(200).json({ success: true, data: departments });
});

const getOne = catchAsync(async (req, res) => {
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) throw AppError.notFound('Department not found');
  res.status(200).json({ success: true, data: department });
});

const create = catchAsync(async (req, res) => {
  const department = await prisma.department.create({ data: req.body });
  await recordAudit({
    userId: req.user.id,
    action: 'DEPARTMENT_CREATED',
    entity: 'Department',
    entityId: department.id,
    metadata: { name: department.name },
    req,
  });
  res.status(201).json({ success: true, data: department });
});

const update = catchAsync(async (req, res) => {
  const department = await prisma.department.update({ where: { id }, data: req.body });
  await recordAudit({
    userId: req.user.id,
    action: 'DEPARTMENT_UPDATED',
    entity: 'Department',
    entityId: department.id,
    metadata: req.body,
    req,
  });
  res.status(200).json({ success: true, data: department });
});

const remove = catchAsync(async (req, res) => {
  await prisma.department.delete({ where: { id } });
  await recordAudit({
    userId: req.user.id,
    action: 'DEPARTMENT_DELETED',
    entity: 'Department',
    entityId: req.params.id,
    req,
  });
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
