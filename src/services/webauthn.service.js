const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const env = require('../config/env');

// In-memory challenge store keyed by userId. In a multi-instance
// deployment this should move to Redis; documented here since the
// spec only requires a single Node process for this build.
const challengeStore = new Map();

function setChallenge(userId, challenge) {
  challengeStore.set(userId, challenge);
}
function popChallenge(userId) {
  const c = challengeStore.get(userId);
  challengeStore.delete(userId);
  return c;
}

// ------------------------------------------------------------
// ENROLLMENT (student registers their phone's fingerprint/Face ID
// as a WebAuthn platform authenticator — no biometric image is
// ever transmitted or stored, only the resulting public key)
// ------------------------------------------------------------

async function getRegistrationOptions(userId, userEmail) {
  const existingCredentials = await prisma.fingerprintCredential.findMany({ where: { userId } });

  const options = await generateRegistrationOptions({
    rpName: env.webauthn.rpName,
    rpID: env.webauthn.rpID,
    userID: Buffer.from(userId),
    userName: userEmail,
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // built-in phone/laptop authenticator only
      userVerification: 'required', // forces biometric/PIN prompt
      residentKey: 'preferred',
    },
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      type: 'public-key',
    })),
  });

  setChallenge(userId, options.challenge);
  return options;
}

async function verifyRegistration(userId, response, deviceLabel) {
  const expectedChallenge = popChallenge(userId);
  if (!expectedChallenge) throw AppError.badRequest('Registration challenge expired. Please try again.');

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: env.webauthn.origin,
      expectedRPID: env.webauthn.rpID,
    });
  } catch (err) {
    throw AppError.badRequest(`Fingerprint enrollment failed: ${err.message}`);
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw AppError.badRequest('Fingerprint enrollment could not be verified');
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

  const credential = await prisma.fingerprintCredential.create({
    data: {
      userId,
      credentialId: Buffer.from(credentialID).toString('base64url'),
      publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
      counter: BigInt(counter),
      deviceLabel: deviceLabel || 'Unnamed device',
      verified: true,
    },
  });

  return credential;
}

// ------------------------------------------------------------
// VERIFICATION (student taps "Sign Attendance" → fingerprint
// prompt → this confirms it was really their enrolled device)
// ------------------------------------------------------------

async function getAuthenticationOptions(userId) {
  const credentials = await prisma.fingerprintCredential.findMany({ where: { userId } });
  if (credentials.length === 0) {
    throw AppError.badRequest('No fingerprint credential enrolled. Please enroll your device first.');
  }

  const options = await generateAuthenticationOptions({
    rpID: env.webauthn.rpID,
    userVerification: 'required',
    allowCredentials: credentials.map((cred) => ({ id: cred.credentialId, type: 'public-key' })),
  });

  setChallenge(userId, options.challenge);
  return options;
}

async function verifyAuthentication(userId, response) {
  const expectedChallenge = popChallenge(userId);
  if (!expectedChallenge) throw AppError.badRequest('Verification challenge expired. Please try again.');

  const credentialId = response.id;
  const credential = await prisma.fingerprintCredential.findUnique({ where: { credentialId } });
  if (!credential || credential.userId !== userId) {
    throw AppError.unauthorized('Unrecognized fingerprint credential');
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: env.webauthn.origin,
      expectedRPID: env.webauthn.rpID,
      authenticator: {
        credentialID: Buffer.from(credential.credentialId, 'base64url'),
        credentialPublicKey: Buffer.from(credential.publicKey, 'base64url'),
        counter: Number(credential.counter),
      },
    });
  } catch (err) {
    throw AppError.unauthorized(`Fingerprint verification failed: ${err.message}`);
  }

  if (!verification.verified) {
    throw AppError.unauthorized('Fingerprint verification failed');
  }

  await prisma.fingerprintCredential.update({
    where: { id: credential.id },
    data: { counter: BigInt(verification.authenticationInfo.newCounter), lastUsedAt: new Date() },
  });

  return true;
}

async function listCredentials(userId) {
  return prisma.fingerprintCredential.findMany({
    where: { userId },
    select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function removeCredential(userId, credentialRowId) {
  const result = await prisma.fingerprintCredential.deleteMany({ where: { id: credentialRowId, userId } });
  if (result.count === 0) throw AppError.notFound('Credential not found');
}

module.exports = {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
  listCredentials,
  removeCredential,
};
