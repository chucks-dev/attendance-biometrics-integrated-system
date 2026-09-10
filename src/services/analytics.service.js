const prisma = require('../config/prisma');

async function overviewStats() {
  const [totalStudents, totalLecturers, totalCourses, totalDepartments, todaySessions] =
    await Promise.all([
      prisma.user.count({
        where: { role: 'STUDENT', isActive: true },
      }),
      prisma.user.count({
        where: { role: 'LECTURER', isActive: true },
      }),
      prisma.course.count(),
      prisma.department.count(),
      prisma.attendanceSession.findMany({
        where: {
          date: {
            equals: new Date(new Date().toISOString().slice(0, 10)),
          },
        },
        select: { id: true },
      }),
    ]);

  const todaySessionIds = todaySessions.map((s) => s.id);

  const todaysAttendanceCount = todaySessionIds.length
    ? await prisma.attendanceRecord.count({
        where: {
          sessionId: { in: todaySessionIds },
        },
      })
    : 0;

  // Overall attendance rate:
  // recorded attendance / expected attendance for closed sessions.
  const closedSessions = await prisma.attendanceSession.findMany({
    where: { status: 'CLOSED' },
    select: { id: true, courseId: true },
  });

  let expected = 0;
  let actual = 0;

  if (closedSessions.length > 0) {
    const courseCounts = closedSessions.reduce((acc, s) => {
      acc[s.courseId] = (acc[s.courseId] || 0) + 1;
      return acc;
    }, {});

    const regCounts = await prisma.courseRegistration.groupBy({
      by: ['courseId'],
      _count: { courseId: true },
      where: {
        courseId: { in: Object.keys(courseCounts) },
      },
    });

    const regMap = Object.fromEntries(
      regCounts.map((r) => [r.courseId, r._count.courseId])
    );

    expected = Object.entries(courseCounts).reduce(
      (sum, [courseId, count]) =>
        sum + count * (regMap[courseId] || 0),
      0
    );

    actual = await prisma.attendanceRecord.count({
      where: {
        sessionId: {
          in: closedSessions.map((s) => s.id),
        },
      },
    });
  }

  const attendanceRate =
    expected > 0 ? Math.round((actual / expected) * 100) : 0;

  return {
    totalStudents,
    totalLecturers,
    totalCourses,
    totalDepartments,
    attendanceRate,
    todaysAttendance: todaysAttendanceCount,
  };
}

async function trend(unit, days) {
  // unit: 'day' — buckets the last N days of attendance record counts.
  const since = new Date();
  since.setDate(since.getDate() - days);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      recordedAt: { gte: since },
    },
    select: {
      recordedAt: true,
    },
  });

  const buckets = {};

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    buckets[d.toISOString().slice(0, 10)] = 0;
  }

  records.forEach((r) => {
    const key = r.recordedAt.toISOString().slice(0, 10);

    if (key in buckets) {
      buckets[key] += 1;
    }
  });

  return Object.entries(buckets).map(([date, count]) => ({
    date,
    count,
  }));
}

async function departmentPerformance() {
  const departments = await prisma.department.findMany({
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  const results = await Promise.all(
    departments.map(async (dept) => {
      const closedSessions = await prisma.attendanceSession.findMany({
        where: {
          status: 'CLOSED',
          course: {
            departmentId: dept.id,
          },
        },
        select: {
          id: true,
          courseId: true,
        },
      });

      if (closedSessions.length === 0) {
        return {
          department: dept.name,
          code: dept.code,
          rate: 0,
        };
      }

      const courseIds = [
        ...new Set(closedSessions.map((s) => s.courseId)),
      ];

      const regCounts = await prisma.courseRegistration.groupBy({
        by: ['courseId'],
        _count: {
          courseId: true,
        },
        where: {
          courseId: {
            in: courseIds,
          },
        },
      });

      const regMap = Object.fromEntries(
        regCounts.map((r) => [r.courseId, r._count.courseId])
      );

      const perCourseSessionCount = closedSessions.reduce((acc, s) => {
        acc[s.courseId] = (acc[s.courseId] || 0) + 1;
        return acc;
      }, {});

      const expected = Object.entries(perCourseSessionCount).reduce(
        (sum, [courseId, count]) =>
          sum + count * (regMap[courseId] || 0),
        0
      );

      const actual = await prisma.attendanceRecord.count({
        where: {
          sessionId: {
            in: closedSessions.map((s) => s.id),
          },
        },
      });

      return {
        department: dept.name,
        code: dept.code,
        rate:
          expected > 0
            ? Math.round((actual / expected) * 100)
            : 0,
      };
    })
  );

  return results;
}

async function attendanceDistribution() {
  const [present, late, absent] = await Promise.all([
    prisma.attendanceRecord.count({
      where: { status: 'PRESENT' },
    }),
    prisma.attendanceRecord.count({
      where: { status: 'LATE' },
    }),
    prisma.attendanceRecord.count({
      where: { status: 'ABSENT' },
    }),
  ]);

  return {
    present,
    late,
    absent,
  };
}

module.exports = {
  overviewStats,
  trend,
  departmentPerformance,
  attendanceDistribution,
};