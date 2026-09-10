const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { notify } = require('./notification.service');

/**
 * Registers a student for one or more courses under the active semester.
 *
 * Rules:
 *  - an active academic session must exist
 *  - an active semester must exist
 *  - each course must match the student's department, program, and level
 *  - duplicate registrations are prevented
 *
 * Historical registrations remain tied to their original semester.
 */
async function registerCourses(studentId, courseIds, req) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  });

  if (!student) {
    throw AppError.notFound('Student profile not found');
  }

  // Get the active semester and its academic session.
  const activeSemester = await prisma.semester.findFirst({
    where: { isActive: true },
    include: {
      academicSession: true,
    },
  });

  if (!activeSemester) {
    throw AppError.badRequest('No active semester configured');
  }

  if (!activeSemester.academicSession.isActive) {
    throw AppError.badRequest('The active semester belongs to an inactive academic session');
  }

  const courses = await prisma.course.findMany({
    where: {
      id: { in: courseIds },
    },
  });

  if (courses.length !== courseIds.length) {
    throw AppError.badRequest('One or more selected courses do not exist');
  }

  // Ensure courses belong to the student's department, program and level.
  const mismatched = courses.filter(
    (c) =>
      c.departmentId !== student.departmentId ||
      c.program !== student.program ||
      c.level !== student.level
  );

  if (mismatched.length > 0) {
    throw AppError.badRequest(
      `The following courses do not match your department/program/level: ${mismatched
        .map((c) => c.courseCode)
        .join(', ')}`
    );
  }

  // If courses are tied to semesters, make sure they belong
  // to the currently active semester.
  const semesterMismatched = courses.filter(
    (c) => c.semesterId && c.semesterId !== activeSemester.id
  );

  if (semesterMismatched.length > 0) {
    throw AppError.badRequest(
      `The following courses are not available for the active semester: ${semesterMismatched
        .map((c) => c.courseCode)
        .join(', ')}`
    );
  }

  // Check registrations for this student in the active semester.
  const alreadyRegistered = await prisma.courseRegistration.findMany({
    where: {
      studentId,
      courseId: { in: courseIds },
      semesterId: activeSemester.id,
    },
    select: {
      courseId: true,
    },
  });

  const alreadyIds = new Set(alreadyRegistered.map((r) => r.courseId));

  const toRegister = courseIds.filter(
    (id) => !alreadyIds.has(id)
  );

  if (toRegister.length === 0) {
    throw AppError.conflict(
      'You are already registered for all selected courses'
    );
  }

  const created = await prisma.$transaction(
    toRegister.map((courseId) =>
      prisma.courseRegistration.create({
        data: {
          studentId,
          courseId,
          semesterId: activeSemester.id,
        },
      })
    )
  );

  await notify({
    userId: student.userId,
    type: 'COURSE_REGISTRATION_SUCCESS',
    title: 'Course Registration Successful',
    message: `You have successfully registered for ${created.length} course(s).`,
  });

  return created;
}

/**
 * Returns all registrations for a student,
 * including the semester and academic session they belong to.
 */
async function myRegistrations(studentId) {
  return prisma.courseRegistration.findMany({
    where: { studentId },
    include: {
      course: {
        include: {
          department: {
            select: {
              name: true,
              code: true,
            },
          },
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
}

/**
 * Unregisters a student from a course in the active semester.
 */
async function unregisterCourse(studentId, courseId) {
  const activeSemester = await prisma.semester.findFirst({
    where: { isActive: true },
  });

  if (!activeSemester) {
    throw AppError.badRequest('No active semester configured');
  }

  const result = await prisma.courseRegistration.deleteMany({
    where: {
      studentId,
      courseId,
      semesterId: activeSemester.id,
    },
  });

  if (result.count === 0) {
    throw AppError.notFound('Registration not found');
  }

  return result;
}

module.exports = {
  registerCourses,
  myRegistrations,
  unregisterCourse,
};