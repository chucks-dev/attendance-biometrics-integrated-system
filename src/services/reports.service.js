const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

async function studentAttendanceReport(studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { department: true, user: { select: { email: true } } },
  });
  if (!student) throw AppError.notFound('Student not found');

  const records = await prisma.attendanceRecord.findMany({
    where: { studentId },
    include: { attendance_Session: { include: { course: true } } },
    orderBy: { signedAt: 'desc' },
  });

  return {
    title: 'Student Attendance Report',
    student: {
      fullName: student.fullName,
      applicationNumber: student.applicationNumber,
      department: student.department.name,
      program: student.program,
      level: student.level,
      email: student.user.email,
    },
    rows: records.map((r) => ({
      courseCode: r.attendanceSession.course.courseCode,
      courseTitle: r.attendanceSession.course.courseTitle,
      date: r.attendanceSession.date.toISOString().slice(0, 10),
      status: r.status,
      verificationMethod: r.verificationMethod,
      signedAt: r.signedAt.toISOString(),
    })),
  };
}

async function courseAttendanceReport(courseId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { department: true, lecturer: true },
  });
  if (!course) throw AppError.notFound('Course not found');

  const sessions = await prisma.attendanceSession.findMany({
    where: { courseId },
    include: { attendanceRecords: { include: { student: true } } },
    orderBy: { date: 'asc' },
  });

  const registrations = await prisma.courseRegistration.findMany({
    where: { courseId },
    include: { student: true },
  });

  const rows = registrations.map((reg) => {
    const attendedSessionIds = new Set();
    sessions.forEach((s) => {
      if (s.attendanceRecords.some((r) => r.studentId === reg.studentId)) attendedSessionIds.add(s.id);
    });
    const closedCount = sessions.filter((s) => s.status === 'CLOSED').length;
    return {
      fullName: reg.student.fullName,
      applicationNumber: reg.student.applicationNumber,
      sessionsAttended: attendedSessionIds.size,
      totalSessions: closedCount,
      percentage: closedCount > 0 ? Math.round((attendedSessionIds.size / closedCount) * 100) : 0,
    };
  });

  return {
    title: 'Course Attendance Report',
    course: {
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      department: course.department.name,
      lecturer: course.lecturer?.fullName || 'Unassigned',
    },
    rows,
  };
}

async function lecturerAttendanceReport(lecturerId) {
  const lecturer = await prisma.lecturer.findUnique({ where: { id: lecturerId } });
  if (!lecturer) throw AppError.notFound('Lecturer not found');

  const sessions = await prisma.attendanceSession.findMany({
    where: { lecturerId },
    include: {
  course: true,
  _count: {
    select: {
      attendance_records: true,
    },
  },
},
    orderBy: { date: 'desc' },
  });

  return {
    title: 'Lecturer Attendance Report',
    lecturer: { fullName: lecturer.fullName },
    rows: sessions.map((s) => ({
      courseCode: s.course.courseCode,
      date: s.date.toISOString().slice(0, 10),
      venue: s.venue,
      status: s.status,
      attendeeCount: s._count.attendanceRecords,
    })),
  };
}

async function departmentAttendanceReport(departmentId) {
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) throw AppError.notFound('Department not found');

  const courses = await prisma.course.findMany({ where: { departmentId } });

  const rows = await Promise.all(
    courses.map(async (course) => {
      const closedSessions = await prisma.attendanceSession.findMany({
        where: { courseId: course.id, status: 'CLOSED' },
        select: { id: true },
      });
      const registrationCount = await prisma.courseRegistration.count({ where: { courseId: course.id } });
      const expected = closedSessions.length * registrationCount;
      const actual = closedSessions.length
        ? await prisma.attendanceRecord.count({
            where: { attendanceSessionId: { in: closedSessions.map((s) => s.id) } },
          })
        : 0;
      return {
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        registeredStudents: registrationCount,
        sessionsHeld: closedSessions.length,
        attendanceRate: expected > 0 ? Math.round((actual / expected) * 100) : 0,
      };
    })
  );

  return { title: 'Department Attendance Report', department: { name: department.name, code: department.code }, rows };
}

async function institutionalAttendanceReport() {
  const departments = await prisma.department.findMany();

  const rows = await Promise.all(
    departments.map(async (dept) => {
      const courses = await prisma.course.findMany({ where: { departmentId: dept.id }, select: { id: true } });
      const courseIds = courses.map((c) => c.id);
      const closedSessions = courseIds.length
        ? await prisma.attendanceSession.findMany({
            where: { courseId: { in: courseIds }, status: 'CLOSED' },
            select: { id: true, courseId: true },
          })
        : [];
      const regCounts = courseIds.length
        ? await prisma.courseRegistration.groupBy({
            by: ['courseId'],
            _count: { courseId: true },
            where: { courseId: { in: courseIds } },
          })
        : [];
      const regMap = Object.fromEntries(regCounts.map((r) => [r.courseId, r._count.courseId]));
      const expected = closedSessions.reduce((sum, s) => sum + (regMap[s.courseId] || 0), 0);
      const actual = closedSessions.length
        ? await prisma.attendanceRecord.count({
            where: { attendanceSessionId: { in: closedSessions.map((s) => s.id) } },
          })
        : 0;
      return {
        department: dept.name,
        code: dept.code,
        courseCount: courses.length,
        sessionsHeld: closedSessions.length,
        attendanceRate: expected > 0 ? Math.round((actual / expected) * 100) : 0,
      };
    })
  );

  return { title: 'Institutional Attendance Report', rows };
}

module.exports = {
  studentAttendanceReport,
  courseAttendanceReport,
  lecturerAttendanceReport,
  departmentAttendanceReport,
  institutionalAttendanceReport,
};
