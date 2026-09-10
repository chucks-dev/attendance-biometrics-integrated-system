const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

/**
 * Access tokens carry role + userId and are short-lived — validated
 * on every request via the `authenticate` middleware.
 */
function signAccessToken(payload) {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

/**
 * Refresh tokens are opaque random strings, not JWTs. We store only
 * a SHA-256 hash of the token server-side (in RefreshToken table),
 * mirroring the pattern used for password reset tokens — the raw
 * token is never persisted, so a DB leak alone doesn't grant reuse.
 */
function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function refreshExpiryDate() {
  const match = /^(\d+)([smhd])$/.exec(env.jwt.refreshExpiresIn);
  const now = Date.now();
  if (!match) return new Date(now + 7 * 24 * 60 * 60 * 1000);
  const [, amountStr, unit] = match;
  const amount = parseInt(amountStr, 10);
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return new Date(now + amount * unitMs);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
};
