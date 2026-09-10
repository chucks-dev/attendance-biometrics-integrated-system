/**
 * Operational error class. Thrown deliberately (not a bug) so the
 * global error handler can distinguish "expected" failures (bad
 * input, not found, unauthorized) from unexpected bugs/crashes.
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'ERROR', details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }
  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }
  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403, 'FORBIDDEN');
  }
  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }
  static conflict(message = 'Conflict') {
    return new AppError(message, 409, 'CONFLICT');
  }
  static internal(message = 'Internal server error') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }
}

module.exports = AppError;
