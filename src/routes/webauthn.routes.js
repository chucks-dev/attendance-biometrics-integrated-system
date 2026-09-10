const express = require('express');
const controller = require('../controllers/webauthn.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { z } = require('zod');

const router = express.Router();
router.use(authenticate, authorize('STUDENT')); // only students enroll/use fingerprint attendance

router.get('/register/options', controller.getRegistrationOptions);
router.post(
  '/register/verify',
  validate({
    body: z.object({
      webauthnResponse: z.record(z.any()),
      deviceLabel: z.string().max(100).optional(),
    }),
  }),
  controller.verifyRegistration
);

router.get('/authenticate/options', controller.getAuthenticationOptions);

router.get('/credentials', controller.listCredentials);
router.delete(
  '/credentials/:id',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  controller.removeCredential
);

module.exports = router;
