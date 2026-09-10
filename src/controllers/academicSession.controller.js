const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditLog.service');

// ------------------------------------------------------------
// Academic Sessions
// ------------------------------------------------------------

const listSessions = catchAsync(async (req, res) => {
  const sessions = await prisma.academicSession.findMany({
    orderBy: { name: 'desc' },
    include: {
      semesters: {
        orderBy: { name: 'asc' },
      },
    },
  });

  res.status(200).json({
    success: true,
    data: sessions,
  });
});

const createSession = catchAsync(async (req, res) => {
  const {
    name,
    startDate,
    endDate,
    isActive,
  } = req.body;

  const session = await prisma.$transaction(async (tx) => {
    if (isActive) {
      await tx.academicSession.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    return tx.academicSession.create({
      data: {
        name,
        startDate,
        endDate,
        isActive: !!isActive,
      },
    });
  });

  await recordAudit({
    userId: req.user.id,
    action: 'ACADEMIC_SESSION_CREATED',
    entity: 'AcademicSession',
    entityId: session.id,
    req,
  });

  res.status(201).json({
    success: true,
    data: session,
  });
});

const activateSession = catchAsync(async (req, res) => {
  const { id } = req.params;

  const existingSession = await prisma.academicSession.findUnique({
    where: { id },
  });

  if (!existingSession) {
    throw AppError.notFound('Academic session not found');
  }

  const session = await prisma.$transaction(async (tx) => {
    await tx.academicSession.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    return tx.academicSession.update({
      where: { id },
      data: { isActive: true },
    });
  });

  await recordAudit({
    userId: req.user.id,
    action: 'ACADEMIC_SESSION_ACTIVATED',
    entity: 'AcademicSession',
    entityId: session.id,
    req,
  });

  res.status(200).json({
    success: true,
    data: session,
  });
});

// ------------------------------------------------------------
// Semesters
// ------------------------------------------------------------

const createSemester = catchAsync(async (req, res) => {
  const {
    academicSessionId,
    name,
    startDate,
    endDate,
    isActive,
  } = req.body;

  const parentSession = await prisma.academicSession.findUnique({
    where: { id: academicSessionId },
  });

  if (!parentSession) {
    throw AppError.badRequest('Academic session does not exist');
  }

  const semester = await prisma.$transaction(async (tx) => {
    if (isActive) {
      await tx.semester.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    return tx.semester.create({
      data: {
        academicSessionId,
        name,
        startDate,
        endDate,
        isActive: !!isActive,
      },
    });
  });

  await recordAudit({
    userId: req.user.id,
    action: 'SEMESTER_CREATED',
    entity: 'Semester',
    entityId: semester.id,
    req,
  });

  res.status(201).json({
    success: true,
    data: semester,
  });
});

const activateSemester = catchAsync(async (req, res) => {
  const { id } = req.params;

  const existingSemester = await prisma.semester.findUnique({
    where: { id },
    include: {
      academicSession: true,
    },
  });

  if (!existingSemester) {
    throw AppError.notFound('Semester not found');
  }

  const semester = await prisma.$transaction(async (tx) => {
    // Deactivate all semesters.
    await tx.semester.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Make the semester active.
    const activatedSemester = await tx.semester.update({
      where: { id },
      data: { isActive: true },
    });

    // Make its parent academic session active too.
    await tx.academicSession.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    await tx.academicSession.update({
      where: { id: existingSemester.academicSessionId },
      data: { isActive: true },
    });

    return activatedSemester;
  });

  await recordAudit({
    userId: req.user.id,
    action: 'SEMESTER_ACTIVATED',
    entity: 'Semester',
    entityId: semester.id,
    req,
  });

  res.status(200).json({
    success: true,
    data: semester,
  });
});

module.exports = {
  listSessions,
  createSession,
  activateSession,
  createSemester,
  activateSemester,
};