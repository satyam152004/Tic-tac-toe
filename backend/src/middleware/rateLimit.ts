import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const handler = (_req: unknown, _res: unknown, next: (e?: unknown) => void) =>
  next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please slow down'));

export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_SEC * 1000,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handler as never,
});

/** Stricter limiter for credential endpoints (brute force / enumeration protection). */
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_SEC * 1000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handler as never,
});
