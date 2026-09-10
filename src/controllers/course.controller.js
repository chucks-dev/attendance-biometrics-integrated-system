const crypto = require('crypto');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { recordAudit } = require('../services/auditLog.service');

const courseInclude = {
  department: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },

  semester: {
    include: {
      academicSession: true,
    },
  },

  course_assignments: {
    include: {
      lecturers: {
        select: {
          id: true,
          fullName: true,
          userId: true,
        },
      },
      semester: {
        include: {
          academicSession: true,
        },
      },
    },
  },
};

function addLecturerToCourse(course) {
  const assignment = course.course_assignments?.find(
    (a) => a.semesterId === course.semesterId
  );

  return {
    ...course,
    lecturer: assignment?.lecturers || null,
  };
}

const list = catchAsync(async (req, res) => {
  const {
    departmentId,
    program,
    level,
    semesterId,
    search,
    page = 1,
    pageSize = 20,
  } = req.query;

  const where = {
    ...(departmentId && { departmentId }),
    ...(program && { program }),
    ...(level && { level }),
    ...(semesterId && { semesterId }),

    ...(search && {
      OR: [
        {
          courseCode: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          courseTitle: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: courseInclude,
      orderBy: {
        courseCode: 'asc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),

    prisma.course.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: items.map(addLecturerToCourse),
    pagination: {
      page: Number(page),
      pageSize: Number(pageSize),
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

/**
 * Courses a student is eligible to register for.
 *
 * Only courses belonging to the currently active semester
 * are returned.
 */
const listAvailableForStudent = catchAsync(async (req, res) => {
  const student = await prisma.student.findUnique({
    where: {
      id: req.user.studentId,
    },
  });

  if (!student) {
    throw AppError.notFound('Student profile not found');
  }

  const activeSemester = await prisma.semester.findFirst({
    where: {
      isActive: true,
    },
    include: {
      academicSession: true,
    },
  });

  if (!activeSemester) {
    throw AppError.badRequest('No active semester configured');
  }

  if (!activeSemester.academicSession.isActive) {
    throw AppError.badRequest(
      'The active semester belongs to an inactive academic session'
    );
  }

  const courses = await prisma.course.findMany({
    where: {
      departmentId: student.departmentId,
      program: student.program,
      level: student.level,
      semesterId: activeSemester.id,
    },
    include: courseInclude,
    orderBy: {
      courseCode: 'asc',
    },
  });

  // Check registrations specifically for the active semester.
  const registeredIds = new Set(
    (
      await prisma.courseRegistration.findMany({
        where: {
          studentId: student.id,
          semesterId: activeSemester.id,
        },
        select: {
          courseId: true,
        },
      })
    ).map((registration) => registration.courseId)
  );

  res.status(200).json({
    success: true,
    data: courses.map((course) => ({
      ...addLecturerToCourse(course),
      isRegistered: registeredIds.has(course.id),
    })),
    activeSemester,
  });
});

const getOne = catchAsync(async (req, res) => {
  const course = await prisma.course.findUnique({
    where: {
      id: req.params.id,
    },
    include: courseInclude,
  });

  if (!course) {
    throw AppError.notFound('Course not found');
  }

  res.status(200).json({
    success: true,
    data: course,
  });
});

const create = catchAsync(async (req, res) => {
  const course = await prisma.course.create({
    data: req.body,
    include: courseInclude,
  });

  await recordAudit({
    userId: req.user.id,
    action: 'COURSE_CREATED',
    entity: 'Course',
    entityId: course.id,
    metadata: {
      courseCode: course.courseCode,
    },
    req,
  });

  res.status(201).json({
    success: true,
    data: course,
  });
});

const update = catchAsync(async (req, res) => {
  const course = await prisma.course.update({
    where: {
      id: req.params.id,
    },
    data: req.body,
    include: courseInclude,
  });

  await recordAudit({
    userId: req.user.id,
    action: 'COURSE_UPDATED',
    entity: 'Course',
    entityId: course.id,
    metadata: req.body,
    req,
  });

  res.status(200).json({
    success: true,
    data: course,
  });
});

/**
 * Assign a lecturer to a course for its semester.
 *
 * Lecturer assignment is stored in course_assignments,
 * not directly on the Course model.
 */
const assignLecturer = catchAsync(async (req, res) => {
  const { lecturerId } = req.body;

  if (!lecturerId) {
    throw AppError.badRequest('Lecturer ID is required');
  }

  const course = await prisma.course.findUnique({
    where: {
      id: req.params.id,
    },
  });

  if (!course) {
    throw AppError.notFound('Course not found');
  }

  if (!course.semesterId) {
    throw AppError.badRequest(
      'This course is not assigned to a semester'
    );
  }

  const lecturer = await prisma.lecturer.findUnique({
    where: {
      id: lecturerId,
    },
  });

  if (!lecturer) {
    throw AppError.notFound('Lecturer not found');
  }

  const assignment = await prisma.course_assignments.upsert({
    where: {
      courseId_lecturerId: {
        courseId: course.id,
        lecturerId,
      },
    },

    update: {
      semesterId: course.semesterId,
    },

    create: {
      id: crypto.randomUUID(),
      courseId: course.id,
      lecturerId,
      semesterId: course.semesterId,
    },

    include: {
      courses: {
        include: courseInclude,
      },
      lecturers: {
        select: {
          id: true,
          fullName: true,
          userId: true,
        },
      },
      semester: {
        include: {
          academicSession: true,
        },
      },
    },
  });

  await recordAudit({
    userId: req.user.id,
    action: 'COURSE_LECTURER_ASSIGNED',
    entity: 'Course',
    entityId: course.id,
    metadata: {
      lecturerId,
      semesterId: course.semesterId,
    },
    req,
  });

  res.status(200).json({
    success: true,
    data: assignment,
  });
});

const remove = catchAsync(async (req, res) => {
  await prisma.course.delete({
    where: {
      id: req.params.id,
    },
  });

  await recordAudit({
    userId: req.user.id,
    action: 'COURSE_DELETED',
    entity: 'Course',
    entityId: req.params.id,
    req,
  });

  res.status(204).send();
});

/**
 * Courses assigned to the currently logged-in lecturer.
 */
const listMyAssignedCourses = catchAsync(async (req, res) => {
  const assignments = await prisma.course_assignments.findMany({
    where: {
      lecturerId: req.user.lecturerId,
    },

    include: {
      courses: {
        include: courseInclude,
      },

      lecturers: {
        select: {
          id: true,
          fullName: true,
          userId: true,
        },
      },

      semester: {
        include: {
          academicSession: true,
        },
      },
    },

    orderBy: {
      createdAt: 'desc',
    },
  });

  res.status(200).json({
    success: true,
    data: assignments.map((assignment) => ({
       ...assignment.courses,
       lecturerId: assignment.lecturerId,
       lecturer: assignment.lecturers,
    })),
  });
});

module.exports = {
  list,
  listAvailableForStudent,
  listMyAssignedCourses,
  getOne,
  create,
  update,
  assignLecturer,
  remove,
};
