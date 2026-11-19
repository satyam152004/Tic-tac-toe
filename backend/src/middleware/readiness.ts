import { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Lifecycle } from '../config/lifecycle.js';

/** Paths that must answer even while the app is still starting (probes, landing page, API docs). */
const ALWAYS_OPEN = [/^\/healthz$/, /^\/readyz$/, /^\/$/, /^\/api\/v1\/health$/, /^\/api\/openapi\.json$/, /^\/api\/docs(\/|$)/];

/**
 * Keeps database-dependent requests (REST and the Socket.IO handshake) out until initialisation has finished, and
 * out again once shutdown has begun. Clients get a retryable 503 instead of a hung request or an obscure 500.
 */
export function readinessGate(state: Lifecycle): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (state.isReady || ALWAYS_OPEN.some((re) => re.test(req.path))) return next();
    const starting = state.current === 'starting';
    res.setHeader('Retry-After', starting ? '5' : '1');
    if (!starting) res.setHeader('Connection', 'close');
    res.status(503).json({
      success: false,
      error: { code: starting ? 'SERVICE_STARTING' : 'SERVICE_SHUTTING_DOWN', message: starting ? 'Service is starting, retry shortly' : 'Service is shutting down, retry shortly' },
      requestId: req.requestId,
    });
  };
}
