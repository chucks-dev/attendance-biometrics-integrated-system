const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Generates a cryptographically random, URL-safe token to embed in
 * the QR payload. This is what students actually scan — it is NOT
 * a guessable session ID, preventing someone from fabricating a
 * QR code by just knowing (or guessing) the session's database id.
 */
function generateQrToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function generateSessionToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Renders a QR code (as a base64 PNG data URL) encoding a scan URL
 * the student's device opens, e.g.:
 *   https://app.fpn.edu.ng/attend/scan?token=<qrCodeToken>
 */
async function generateQrDataUrl(qrCodeToken, clientUrl) {
  const scanUrl = `${clientUrl}/attend/scan?token=${qrCodeToken}`;
  return QRCode.toDataURL(scanUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  });
}

module.exports = { generateQrToken, generateSessionToken, generateQrDataUrl };
