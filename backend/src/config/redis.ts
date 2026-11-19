import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Returns a Redis client only when REDIS_URL is configured (Redis is optional infrastructure).
 *
 * An unreachable Redis never blocks startup or crashes the process: ioredis reconnects with a capped backoff and
 * the Socket.IO adapter keeps working for the local instance. Errors are logged at most once per 30s so a long
 * outage does not flood the logs.
 */
export function createRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // required for pub/sub connections used by the Socket.IO adapter
    connectTimeout: 10_000,
    retryStrategy: (attempt) => Math.min(attempt * 500, 10_000),
  });
  let lastLogged = 0;
  client.on('error', (err: Error) => {
    const now = Date.now();
    if (now - lastLogged < 30_000) return;
    lastLogged = now;
    logger.error({ err: err.message }, 'Redis error');
  });
  client.on('ready', () => logger.info('Redis ready'));
  return client;
}
