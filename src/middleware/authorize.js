const AppError = require('../utils/AppError');

/**
 * Restricts a route to one or more roles. Must run after
 * `authenticate`, which populates req.user.
 *
 * Usage: router.post('/courses', authenticate, authorize('SUPER_ADMIN'), handler)
 */
function authorize(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

module.exports = authorize;
