const { z } = require('zod');

const createSessionSchema = z.object({
  courseId: z.string().uuid(),
  venue: z.string().min(2).max(120),
  date: z.string().datetime().or(z.string().min(8)), // accept date-only or ISO datetime
  startTime: z.string(),
  endTime: z.string(),
  requiredVerification: z.enum(['QR_CODE', 'DEVICE_FINGERPRINT', 'QR_AND_FINGERPRINT']).optional(),
});

const scanQrSchema = z.object({
  qrCodeToken: z.string().min(10),
});

// webauthnResponse is the raw AuthenticationResponseJSON produced by
// the browser's navigator.credentials.get() — shape is defined by
// the WebAuthn spec / @simplewebauthn/browser, so we validate it
// loosely here and let the server-side verifier do the real check.
const webauthnResponseSchema = z.object({
  id: z.string(),
  rawId: z.string(),
  type: z.literal('public-key'),
  response: z.object({
    clientDataJSON: z.string(),
    authenticatorData: z.string(),
    signature: z.string(),
    userHandle: z.string().optional(),
  }),
  clientExtensionResults: z.record(z.any()).optional(),
});

const fingerprintSignSchema = z.object({
  attendanceSessionId: z.string().uuid(),
  webauthnResponse: webauthnResponseSchema,
});

const completeCombinedSchema = z.object({
  sessionToken: z.string().min(10),
  webauthnResponse: webauthnResponseSchema,
});

const idParamSchema = z.object({ id: z.string().uuid() });
const courseIdParamSchema = z.object({ courseId: z.string().uuid() });

module.exports = {
  createSessionSchema,
  scanQrSchema,
  fingerprintSignSchema,
  completeCombinedSchema,
  idParamSchema,
  courseIdParamSchema,
};
