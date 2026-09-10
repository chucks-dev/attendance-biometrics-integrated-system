const express = require('express');
const controller = require('../controllers/analytics.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate, authorize('SUPER_ADMIN'));

router.get('/overview', controller.overview);
router.get('/trend/daily', controller.dailyTrend);
router.get('/trend/weekly', controller.weeklyTrend);
router.get('/trend/monthly', controller.monthlyTrend);
router.get('/department-performance', controller.departmentPerformance);
router.get('/distribution', controller.distribution);

module.exports = router;
