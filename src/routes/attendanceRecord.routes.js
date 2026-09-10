const express = require('express');
const controller = require('../controllers/attendanceRecord.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { recordQuerySchema } = require('../validators/attendanceRecord.validator');

const router = express.Router();
router.use(authenticate);

router.get('/', validate({ query: recordQuerySchema }), controller.list); // scoped by role in controller
router.get('/my-percentage', authorize('STUDENT'), controller.myAttendancePercentage);

module.exports = router;
