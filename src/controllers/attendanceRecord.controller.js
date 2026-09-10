const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const recordInclude = {
  student: {
    select: {
      fullName: true,
      applicationNumber: true,
    },
  },
  attendance_sessions: {
    include: {
      course: {
        select: {
          courseCode: true,
          courseTitle: true,
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

/**
 * Unified search/filter for attendance records.
 *
 * Scoped by role:
 *  - SUPER_ADMIN: sees everything
 *  - LECTURER: only records for sessions they created
 *  - STUDENT: only their own records
 */
const list = catchAsync(async (req, res) => {
  const {
    courseId,
    studentId,
    status,
    verificationMethod,
    dateFrom,
    dateTo,
    search,
    page = 1,
    pageSize = 20,
  } = req.query;

  const where = {
    ...(courseId && {
      attendance_sessions: {
        courseId,
      },
    }),

    ...(status && {
      status,
    }),

    ...(verificationMethod && {
      verificationMethod,
    }),

    ...((dateFrom || dateTo) && {
      recordedAt: {
        ...(dateFrom && {
          gte: new Date(dateFrom),
        }),
        ...(dateTo && {
          lte: new Date(dateTo),
        }),
      },
    }),

    ...(search && {
      student: {
        OR: [
          {
            fullName: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            applicationNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      },
    }),
  };

  /*
   * Lecturer sees only attendance records belonging
   * to sessions created by that lecturer.
   */
  if (req.user.role === 'LECTURER') {
    where.attendance_sessions = {
      ...(where.attendance_sessions || {}),
      lecturerId: req.user.lecturerId,
    };
  }

  /*
   * Student sees only their own attendance records.
   */
  if (req.user.role === 'STUDENT') {
    where.studentId = req.user.studentId;
  }

  /*
   * Admin can optionally filter by a specific student.
   */
  if (req.user.role === 'SUPER_ADMIN' && studentId) {
    where.studentId = studentId;
  }

  const pageNumber = Number(page);
  const pageSizeNumber = Number(pageSize);

  const [items, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: recordInclude,
      orderBy: {
        recordedAt: 'desc',
      },
      skip: (pageNumber - 1) * pageSizeNumber,
      take: pageSizeNumber,
    }),

    prisma.attendanceRecord.count({
      where,
    }),
  ]);

  res.status(200).json({
    success: true,
    data: items,
    pagination: {
      page: pageNumber,
      pageSize: pageSizeNumber,
      total,
      totalPages: Math.ceil(total / pageSizeNumber),
    },
  });
});


/**
 * Student's attendance percentage per registered course.
 *
 * Attendance is calculated within the semester of the registration,
 * so historical semester records remain separate.
 */
const myAttendancePercentage = catchAsync(async (req, res) => {
  const registrations = await prisma.courseRegistration.findMany({
    where: {
      studentId: req.user.studentId,
    },
    include: {
      course: {
        select: {
          id: true,
          courseCode: true,
          courseTitle: true,
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

  const results = await Promise.all(
    registrations.map(async (reg) => {
      const sessionWhere = {
        courseId: reg.courseId,
        status: 'CLOSED',
        ...(reg.semesterId
          ? {
              semesterId: reg.semesterId,
            }
          : {}),
      };

      const totalSessions = await prisma.attendanceSession.count({
        where: sessionWhere,
      });

      const attended = await prisma.attendanceRecord.count({
        where: {
          studentId: req.user.studentId,
          attendance_sessions: sessionWhere,
        },
      });

      const percentage =
        totalSessions === 0
          ? null
          : Math.round((attended / totalSessions) * 100);

      return {
        course: reg.course,
        semester: reg.semester,
        totalSessions,
        attended,
        percentage,
      };
    })
  );

  res.status(200).json({
    success: true,
    data: results,
  });
});


module.exports = {
  list,
  myAttendancePercentage,
};