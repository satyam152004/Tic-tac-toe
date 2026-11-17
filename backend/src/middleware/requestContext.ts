import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';

/** Adds a request id and emits one structured log line per request. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const id = (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].slice(0, 64)) || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info({ requestId: id, method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Math.round(ms), userId: req.auth?.userId }, 'request');
  });
  next();
}
