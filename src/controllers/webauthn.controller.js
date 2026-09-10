const catchAsync = require('../utils/catchAsync');
const webauthnService = require('../services/webauthn.service');

const getRegistrationOptions = catchAsync(async (req, res) => {
  const options = await webauthnService.getRegistrationOptions(req.user.id, req.user.email);
  res.status(200).json({ success: true, data: options });
});

const verifyRegistration = catchAsync(async (req, res) => {
  const credential = await webauthnService.verifyRegistration(
    req.user.id,
    req.body.webauthnResponse,
    req.body.deviceLabel
  );
  res.status(201).json({
    success: true,
    message: 'Fingerprint enrolled successfully',
    data: { id: credential.id, deviceLabel: credential.deviceLabel, createdAt: credential.createdAt },
  });
});

const getAuthenticationOptions = catchAsync(async (req, res) => {
  const options = await webauthnService.getAuthenticationOptions(req.user.id);
  res.status(200).json({ success: true, data: options });
});

const listCredentials = catchAsync(async (req, res) => {
  const credentials = await webauthnService.listCredentials(req.user.id);
  res.status(200).json({ success: true, data: credentials });
});

const removeCredential = catchAsync(async (req, res) => {
  await webauthnService.removeCredential(req.user.id, req.params.id);
  res.status(204).send();
});

module.exports = {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  listCredentials,
  removeCredential,
};
