const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const reportsService = require('../services/reports.service');
const exportService = require('../services/export.service');

/**
 * Generic responder: fetches the report via `fetchFn`, then either
 * returns JSON (default) or streams it as csv/excel/pdf based on
 * ?format=. Filenames are slugified from the report title.
 */
async function respondWithReport(res, report, format) {
  const filenameBase = report.title.toLowerCase().replace(/\s+/g, '-');

  if (!format || format === 'json') {
    return res.status(200).json({ success: true, data: report });
  }

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    return res.status(200).send(exportService.toCsv(report));
  }

  if (format === 'excel' || format === 'xlsx') {
    const buffer = await exportService.toExcelBuffer(report);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    return res.status(200).send(buffer);
  }

  if (format === 'pdf') {
    const buffer = await exportService.toPdfBuffer(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
    return res.status(200).send(buffer);
  }

  throw AppError.badRequest('Unsupported export format. Use csv, excel, pdf, or json.');
}

const studentReport = catchAsync(async (req, res) => {
  // Students may only pull their own report; admin/lecturer can pull any.
  const studentId = req.user.role === 'STUDENT' ? req.user.studentId : req.params.studentId;
  if (!studentId) throw AppError.badRequest('studentId is required');
  const report = await reportsService.studentAttendanceReport(studentId);
  await respondWithReport(res, report, req.query.format);
});

const courseReport = catchAsync(async (req, res) => {
  const report = await reportsService.courseAttendanceReport(req.params.courseId);
  await respondWithReport(res, report, req.query.format);
});

const lecturerReport = catchAsync(async (req, res) => {
  const lecturerId = req.user.role === 'LECTURER' ? req.user.lecturerId : req.params.lecturerId;
  if (!lecturerId) throw AppError.badRequest('lecturerId is required');
  const report = await reportsService.lecturerAttendanceReport(lecturerId);
  await respondWithReport(res, report, req.query.format);
});

const departmentReport = catchAsync(async (req, res) => {
  const report = await reportsService.departmentAttendanceReport(req.params.departmentId);
  await respondWithReport(res, report, req.query.format);
});

const institutionalReport = catchAsync(async (req, res) => {
  const report = await reportsService.institutionalAttendanceReport();
  await respondWithReport(res, report, req.query.format);
});

module.exports = { studentReport, courseReport, lecturerReport, departmentReport, institutionalReport };
