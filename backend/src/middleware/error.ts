import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { isProd } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError, Errors } from '../utils/errors.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(Errors.notFound(`Route ${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND'));
}

/** Single place where every error becomes a consistent JSON envelope. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: unknown;

  const anyErr = err as { type?: string; code?: number; keyPattern?: Record<string, unknown>; status?: number };

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = `Invalid value for ${err.path}`;
  } else if (anyErr?.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = 'Resource already exists';
    details = { fields: Object.keys(anyErr.keyPattern ?? {}) };
  } else if (anyErr?.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON body';
  } else if (anyErr?.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'That request is too large.';
  }

  if (status >= 500) {
    logger.error({ err, requestId: req.requestId, path: req.path }, 'Unhandled error');
    if (isProd) message = 'Internal server error';
    else message = err instanceof Error ? err.message : message;
  }

  res.status(status).json({ success: false, error: { code, message, ...(details !== undefined ? { details } : {}) }, requestId: req.requestId });
}
