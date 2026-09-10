const catchAsync = require('../utils/catchAsync');
const analyticsService = require('../services/analytics.service');

const overview = catchAsync(async (req, res) => {
  const data = await analyticsService.overviewStats();
  res.status(200).json({ success: true, data });
});

const dailyTrend = catchAsync(async (req, res) => {
  const data = await analyticsService.trend('day', 14);
  res.status(200).json({ success: true, data });
});

const weeklyTrend = catchAsync(async (req, res) => {
  const data = await analyticsService.trend('day', 84); // ~12 weeks of daily points; frontend can bucket
  res.status(200).json({ success: true, data });
});

const monthlyTrend = catchAsync(async (req, res) => {
  const data = await analyticsService.trend('day', 365);
  res.status(200).json({ success: true, data });
});

const departmentPerformance = catchAsync(async (req, res) => {
  const data = await analyticsService.departmentPerformance();
  res.status(200).json({ success: true, data });
});

const distribution = catchAsync(async (req, res) => {
  const data = await analyticsService.attendanceDistribution();
  res.status(200).json({ success: true, data });
});

module.exports = { overview, dailyTrend, weeklyTrend, monthlyTrend, departmentPerformance, distribution };
