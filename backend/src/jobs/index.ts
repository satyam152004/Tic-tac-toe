import { logger } from '../config/logger.js';
import { sweep as sweepMatchmaking } from '../matchmaking/matchmaking.service.js';
import { UserModel } from '../models/index.js';
import { processGameTimeouts } from '../services/game.service.js';
import { expireRooms } from '../services/room.service.js';

/**
 * Background maintenance. All jobs are idempotent and rely on atomic DB transitions, so running them
 * on every backend instance at once is safe (no leader election needed).
 *
 * Retention is handled by MongoDB TTL indexes (refresh tokens, notifications, cancelled/finished games,
 * moves, rooms, matchmaking tickets, device tokens, leaderboard rows, audit logs) - see docs/DATABASE.md.
 */
function every(name: string, ms: number, fn: () => Promise<unknown>): NodeJS.Timeout {
  let running = false;
  const t = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const out = await fn();
      if (out && typeof out === 'object' && Object.values(out as Record<string, number>).some((n) => typeof n === 'number' && n > 0)) logger.info({ job: name, out }, 'job ran');
    } catch (err) {
      logger.error({ job: name, err: (err as Error).message }, 'job failed');
    } finally {
      running = false;
    }
  }, ms);
  t.unref();
  return t;
}

export function startJobs(): () => void {
  const timers = [
    every('game-timeouts', 5_000, () => processGameTimeouts()),
    every('matchmaking-sweep', 3_000, () => sweepMatchmaking()),
    every('room-expiry', 30_000, async () => ({ expired: await expireRooms() })),
    every('presence-cleanup', 30_000, async () => {
      // Clients heartbeat every ~25s; anyone silent for 90s is considered offline.
      const r = await UserModel.updateMany({ online: true, lastActiveAt: { $lt: new Date(Date.now() - 90_000) } }, { $set: { online: false } });
      return { markedOffline: r.modifiedCount };
    }),
  ];
  return () => timers.forEach(clearInterval);
}
