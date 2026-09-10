const catchAsync = require('../utils/catchAsync');
const authService = require('../services/auth.service');
const env = require('../config/env');

const REFRESH_COOKIE_NAME = 'fpn_refresh_token';

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
}

function getRefreshTokenFromReq(req) {
  return req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
}

// ------------------------------------------------------------

const adminLogin = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.loginAdmin(req.body, req);
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ success: true, data: { user, accessToken } });
});

const lecturerRegister = catchAsync(async (req, res) => {
  const user = await authService.registerLecturer(req.body, req);
  res.status(201).json({
    success: true,
    message: 'Registration successful. You may now log in.',
    data: { user },
  });
});

const lecturerLogin = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.loginLecturer(req.body, req);
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ success: true, data: { user, accessToken } });
});

const studentRegister = catchAsync(async (req, res) => {
  const user = await authService.registerStudent(req.body, req);
  res.status(201).json({
    success: true,
    message: 'Registration successful. You may now log in.',
    data: { user },
  });
});

const studentLogin = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.loginStudent(req.body, req);
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ success: true, data: { user, accessToken } });
});

const refresh = catchAsync(async (req, res) => {
  const rawToken = getRefreshTokenFromReq(req);
  const { accessToken, refreshToken } = await authService.refreshTokens(rawToken, req);
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ success: true, data: { accessToken } });
});

const logout = catchAsync(async (req, res) => {
  const rawToken = getRefreshTokenFromReq(req);
  await authService.logout(rawToken);
  clearRefreshCookie(res);
  res.status(200).json({ success: true, message: 'Logged out' });
});

const changePassword = catchAsync(async (req, res) => {
  await authService.changePassword(req.user.id, req.body, req);
  res.status(200).json({ success: true, message: 'Password changed successfully' });
});

const me = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, data: { user: req.user } });
});

module.exports = {
  adminLogin,
  lecturerRegister,
  lecturerLogin,
  studentRegister,
  studentLogin,
  refresh,
  logout,
  changePassword,
  me,
};
