const catchAsync = require('../utils/catchAsync');
const registrationService = require('../services/registration.service');

const registerCourses = catchAsync(async (req, res) => {
  const registrations = await registrationService.registerCourses(req.user.studentId, req.body.courseIds, req);
  res.status(201).json({ success: true, data: registrations });
});

const myRegistrations = catchAsync(async (req, res) => {
  const registrations = await registrationService.myRegistrations(req.user.studentId);
  res.status(200).json({ success: true, data: registrations });
});

const unregisterCourse = catchAsync(async (req, res) => {
  await registrationService.unregisterCourse(req.user.studentId, req.params.courseId);
  res.status(204).send();
});

module.exports = { registerCourses, myRegistrations, unregisterCourse };
