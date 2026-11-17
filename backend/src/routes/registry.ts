import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRegistered } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import type { SessionContext } from '../services/auth.service.js';

/**
 * Declarative route table. Each definition drives THREE things from one source of truth:
 *   1. the Express route (with auth + validation middleware),
 *   2. the OpenAPI document (Swagger UI at /api/docs),
 *   3. docs/API.md (npm run docs:api).
 */
export interface Ctx<B = any, Q = any, P = any> {
  req: Request;
  userId: string;
  body: B;
  query: Q;
  params: P;
  session: SessionContext;
}

export interface RouteSpec<B extends z.ZodType, Q extends z.ZodType, P extends z.ZodType> {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string; // relative to /api/v1, express style (:id)
  tag: string;
  summary: string;
  auth?: 'none' | 'user' | 'registered';
  body?: B;
  query?: Q;
  params?: P;
  /** HTTP status on success (default 200). */
  status?: number;
  /** Human description of `data` in the success response. */
  response: string;
  /** Domain error codes this endpoint can return (in addition to the common ones). */
  errors?: string[];
  strictLimit?: boolean;
  handler: (c: Ctx<z.output<B>, z.output<Q>, z.output<P>>) => unknown | Promise<unknown>;
}

export interface RouteDef {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  tag: string;
  summary: string;
  auth: 'none' | 'user' | 'registered';
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
  status: number;
  response: string;
  errors: string[];
  strictLimit: boolean;
  handler: (c: Ctx) => unknown | Promise<unknown>;
}

export function route<B extends z.ZodType = z.ZodAny, Q extends z.ZodType = z.ZodAny, P extends z.ZodType = z.ZodAny>(spec: RouteSpec<B, Q, P>): RouteDef {
  return {
    method: spec.method,
    path: spec.path,
    tag: spec.tag,
    summary: spec.summary,
    auth: spec.auth ?? 'user',
    body: spec.body,
    query: spec.query,
    params: spec.params,
    status: spec.status ?? 200,
    response: spec.response,
    errors: spec.errors ?? [],
    strictLimit: spec.strictLimit ?? false,
    handler: spec.handler as RouteDef['handler'],
  };
}

export const sessionOf = (req: Request): SessionContext => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  deviceName: typeof req.body?.deviceName === 'string' ? req.body.deviceName : undefined,
});

/** Serialise handler results: Paged-like objects ({items, meta, ...extra}) become data + meta. */
function send(res: Response, status: number, result: unknown): void {
  if (res.headersSent) return;
  if (result && typeof result === 'object' && 'items' in result && 'meta' in result) {
    const { items, meta, ...extra } = result as { items: unknown; meta: Record<string, unknown> } & Record<string, unknown>;
    res.status(status).json({ success: true, data: items, meta: { ...meta, ...extra } });
    return;
  }
  res.status(status).json({ success: true, data: result === undefined ? null : result });
}

export function mountRoutes(router: Router, defs: RouteDef[]): void {
  for (const d of defs) {
    const chain: RequestHandler[] = [];
    if (d.strictLimit) chain.push(authLimiter);
    if (d.auth !== 'none') chain.push(authenticate);
    if (d.auth === 'registered') chain.push(requireRegistered);
    chain.push(validate({ body: d.body, query: d.query, params: d.params }));
    chain.push(async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await d.handler({
          req,
          userId: req.auth?.userId ?? '',
          body: req.body,
          query: req.query,
          params: req.params,
          session: sessionOf(req),
        });
        send(res, d.status, result);
      } catch (err) {
        next(err);
      }
    });
    router[d.method](d.path, ...chain);
  }
}
