const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/jwt');
const prisma = require('../config/prisma');

/**
 * Verifies the Bearer access token and attaches `req.user` with
 * { id, role, email, status } plus role-specific profile ids
 * (studentId / lecturerId) where applicable.
 *
 * Also enforces that the account is still ACTIVE — a token issued
 * before a suspension should not keep working.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw AppError.unauthorized('Missing or malformed authorization header');
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      throw AppError.unauthorized('Invalid or expired access token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { student: true, lecturer: true },
    });

    if (!user) throw AppError.unauthorized('Account no longer exists');

if (!user.isActive) {
  throw AppError.forbidden('Account is not active. Contact the administrator.');
}

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      studentId: user.student?.id ?? null,
      lecturerId: user.lecturer?.id ?? null,
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authenticate;
