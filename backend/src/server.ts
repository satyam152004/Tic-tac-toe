import { createServer } from 'node:http';
import type { Server as IoServer } from 'socket.io';
import type { Redis } from 'ioredis';
import { createApp } from './app.js';
import { connectDbWithRetry, disconnectDb, syncIndexes } from './config/db.js';
import { env } from './config/env.js';
import { lifecycle } from './config/lifecycle.js';
import { logger } from './config/logger.js';
import { createRedis } from './config/redis.js';
import { startJobs } from './jobs/index.js';
import { seedAchievements } from './services/achievement.service.js';
import { realtime } from './services/realtime.js';
import { createSocketServer } from './sockets/index.js';

// Render (and most load balancers) must reach the port before the platform's deadline, so the HTTP server starts
// listening first. Database-dependent work happens afterwards; until it finishes the readiness gate answers 503.
const HOST = '0.0.0.0';
const SHUTDOWN_TIMEOUT_MS = 15_000;

async function main(): Promise<void> {
  lifecycle.stage('modules-loaded');

  const app = createApp({ lifecycle });
  const httpServer = createServer(app);
  // Must exceed the load balancer's idle timeout (Render: 60s) or keep-alive connections get reset mid-request (502s).
  httpServer.keepAliveTimeout = 65_000;
  httpServer.headersTimeout = 66_000;

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(env.PORT, HOST, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });
  // After startup, a socket-level server error must be logged instead of crashing through 'uncaughtException'.
  httpServer.on('error', (err) => logger.error({ err }, 'HTTP server error'));
  lifecycle.stage('http-listening', { host: HOST, port: env.PORT, env: env.NODE_ENV });

  let io: IoServer | null = null;
  let pub: Redis | null = null;
  let sub: Redis | null = null;
  let stopJobs: (() => void) | null = null;
  const abortInit = new AbortController();

  const shutdown = async (signal: string) => {
    if (lifecycle.isShuttingDown) return;
    lifecycle.markShuttingDown();
    abortInit.abort();
    logger.info({ signal }, 'Graceful shutdown started');
    const force = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();
    try {
      stopJobs?.();
      realtime.getIo()?.emit('server:shutdown', { reconnectInMs: 2000 });
      if (io) {
        await io.close(); // closes websocket connections and the underlying http server
      } else {
        await new Promise<void>((resolve) => {
          httpServer.close(() => resolve());
          httpServer.closeIdleConnections();
        });
      }
      await disconnectDb();
      pub?.disconnect();
      sub?.disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // ---- database-dependent initialisation (the server is already reachable; readiness stays false until done) ----
  await connectDbWithRetry({
    signal: abortInit.signal,
    onAttemptFailed: (err) => lifecycle.setError(`MongoDB: ${err.message}`),
  });
  lifecycle.stage('mongo-connected');
  if (lifecycle.isShuttingDown) return;

  await syncIndexes();
  lifecycle.stage('indexes-synced');

  await seedAchievements();
  lifecycle.stage('seed-complete');

  // Created only now: until then the Socket.IO path falls through to Express, where the readiness gate answers 503.
  pub = env.REDIS_URL ? createRedis() : null;
  sub = pub ? pub.duplicate() : null;
  io = createSocketServer(httpServer, pub && sub ? { pub, sub } : null);
  if (pub) logger.info('Socket.IO Redis adapter enabled (horizontal scaling)');
  lifecycle.stage('realtime-ready', { redis: !!pub });

  if (lifecycle.isShuttingDown) return;
  stopJobs = startJobs();
  lifecycle.stage('jobs-started');
  lifecycle.markReady();
}

process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  process.exit(1);
});

main().catch((err) => {
  // A signal arriving mid-startup aborts the connection retry; the shutdown handler owns the exit code then.
  if (lifecycle.isShuttingDown) return;
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
