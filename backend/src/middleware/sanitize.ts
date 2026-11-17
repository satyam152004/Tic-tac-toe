import { NextFunction, Request, Response } from 'express';

/**
 * MongoDB operator-injection protection: strips any key that begins with `$` or contains `.`
 * from body, query and params (e.g. {"email": {"$gt": ""}} becomes {"email": {}}).
 * Zod validation then rejects the leftovers, so this is defence in depth.
 */
function clean(value: unknown, depth = 0): void {
  if (depth > 10 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((v) => clean(v, depth + 1));
    return;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__') {
      delete obj[key];
    } else {
      clean(obj[key], depth + 1);
    }
  }
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
}

/** For socket payloads. */
export function sanitizePayload<T>(payload: T): T {
  clean(payload);
  return payload;
}
