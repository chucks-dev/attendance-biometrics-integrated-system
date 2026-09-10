import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (!err.isOperational || err.statusCode >= 500) {
      logger.error(err.message, { stack: err.stack, path: req.originalUrl });
    }
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  const error = err as Error;
  logger.error(error?.message ?? 'Unknown error', { stack: error?.stack, path: req.originalUrl });

  return res.status(500).json({
    success: false,
    message: env.isProd ? 'Internal server error' : error?.message ?? 'Internal server error',
    ...(env.isProd ? {} : { stack: error?.stack }),
  });
}

// Wraps async route handlers so thrown/rejected errors reach errorHandler
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
