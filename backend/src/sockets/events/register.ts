import type { Socket } from 'socket.io';
import { ZodType } from 'zod';
import { logger } from '../../config/logger.js';
import { sanitizePayload } from '../../middleware/sanitize.js';
import { AppError } from '../../utils/errors.js';
import { TokenBucket } from '../rateLimiter.js';
import { env } from '../../config/env.js';
import { UserModel } from '../../models/index.js';

export type Ack = (response: { ok: boolean; data?: unknown; error?: { code: string; message: string; details?: unknown } }) => void;

export interface SocketUser {
  userId: string;
}

const lastTouch = new Map<string, number>();

/**
 * Registers a client->server event with: rate limiting, payload sanitising + zod validation,
 * uniform ack responses and error mapping. Handlers only ever act for `socket.data.userId`
 * (never an id taken from the payload), which is what enforces authorization.
 */
export function registerEvent<T>(
  socket: Socket,
  bucket: TokenBucket,
  event: string,
  schema: ZodType<T> | null,
  handler: (userId: string, payload: T, socket: Socket) => Promise<unknown> | unknown,
  onError?: (err: AppError, payload: unknown) => void,
): void {
  socket.on(event, async (raw: unknown, maybeAck?: unknown) => {
    // socket.io passes the ack as the 2nd arg, or as the 1st when no payload was sent.
    const ack: Ack | undefined = typeof maybeAck === 'function' ? (maybeAck as Ack) : typeof raw === 'function' ? (raw as Ack) : undefined;
    const rawPayload = typeof raw === 'function' ? undefined : raw;
    const userId = socket.data.userId as string;
    try {
      if (!bucket.take()) {
        if (bucket.violations > 25) socket.disconnect(true);
        throw new AppError(429, 'RATE_LIMITED', 'Too many events');
      }
      let payload: T = undefined as T;
      if (schema) {
        const parsed = schema.safeParse(sanitizePayload(rawPayload ?? {}));
        if (!parsed.success) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Invalid payload', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
        }
        payload = parsed.data;
      }
      // Any authenticated event counts as activity (throttled to one DB write / 15s / user).
      const now = Date.now();
      if (now - (lastTouch.get(userId) ?? 0) > 15_000) {
        lastTouch.set(userId, now);
        UserModel.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date(), online: true } }).catch(() => undefined);
      }
      const data = await handler(userId, payload, socket);
      ack?.({ ok: true, data });
    } catch (err) {
      const e =
        err instanceof AppError
          ? err
          : new AppError(500, 'INTERNAL_ERROR', 'Internal server error');
      if (!(err instanceof AppError)) logger.error({ err, event }, 'socket handler error');
      onError?.(e, rawPayload);
      ack?.({ ok: false, error: { code: e.code, message: e.message, details: e.details } });
    }
  });
}

export const socketRate = () => new TokenBucket(env.SOCKET_EVENTS_PER_SEC);
