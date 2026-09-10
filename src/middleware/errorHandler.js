const { ZodError } = require('zod');
const { Prisma } = require('@prisma/client');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const env = require('../config/env');

function errorHandler(err, req, res, next) {
  let error = err;

  // Zod validation errors → 400 with field-level details
  if (err instanceof ZodError) {
    error = AppError.badRequest(
      'Validation failed',
      err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }))
    );
  }

  // Known Prisma errors → friendly messages instead of leaking SQL
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error('PRISMA ERROR:', err);
    if (err.code === 'P2002') {
      error = AppError.conflict(
        `A record with this ${err.meta?.target?.join?.(', ') || 'value'} already exists`
      );
    } else if (err.code === 'P2025') {
      error = AppError.notFound('Record not found');
    } else if (err.code === 'P2003') {
      error = AppError.badRequest('Invalid reference to a related record');
    } else {
      error = AppError.internal('Database error');
    }
  }

  if (!(error instanceof AppError)) {
    logger.error(err.stack || err.message || err);
    error = AppError.internal(
      env.nodeEnv === 'development' ? err.message : 'Something went wrong'
    );
  }

  if (error.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} — ${error.message}`);
  }

  res.status(error.statusCode).json({
    success: false,
    code: error.code,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
    ...(env.nodeEnv === 'development' && error.statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

module.exports = { errorHandler, notFoundHandler };
