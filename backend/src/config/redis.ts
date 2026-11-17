import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

/** Returns a Redis client only when REDIS_URL is configured (Redis is optional infrastructure). */
export function createRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  const client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  client.on('error', (err: Error) => logger.error({ err: err.message }, 'Redis error'));
  return client;
}
