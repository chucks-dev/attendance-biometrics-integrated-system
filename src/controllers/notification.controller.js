const catchAsync = require('../utils/catchAsync');
const notificationService = require('../services/notification.service');

const list = catchAsync(async (req, res) => {
  const { unreadOnly, page = 1, pageSize = 20 } = req.query;
  const result = await notificationService.listForUser(req.user.id, {
    unreadOnly: unreadOnly === 'true',
    page: Number(page),
    pageSize: Number(pageSize),
  });
  res.status(200).json({ success: true, ...result });
});

const markRead = catchAsync(async (req, res) => {
  await notificationService.markRead(req.user.id, req.params.id);
  res.status(200).json({ success: true });
});

const markAllRead = catchAsync(async (req, res) => {
  await notificationService.markAllRead(req.user.id);
  res.status(200).json({ success: true });
});

module.exports = { list, markRead, markAllRead };
