import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDb, disconnectDb, syncIndexes } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { createRedis } from './config/redis.js';
import { startJobs } from './jobs/index.js';
import { seedAchievements } from './services/achievement.service.js';
import { realtime } from './services/realtime.js';
import { createSocketServer } from './sockets/index.js';

async function main(): Promise<void> {
  await connectDb();
  await syncIndexes();
  await seedAchievements();

  const app = createApp();
  const httpServer = createServer(app);

  const redisUrl = env.REDIS_URL;
  const pub = redisUrl ? createRedis() : null;
  const sub = pub ? pub.duplicate() : null;
  const io = createSocketServer(httpServer, pub && sub ? { pub, sub } : null);
  if (pub) logger.info('Socket.IO Redis adapter enabled (horizontal scaling)');

  const stopJobs = startJobs();

  await new Promise<void>((resolve) => httpServer.listen(env.PORT, resolve));
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server listening');

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown started');
    const force = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15_000);
    force.unref();
    try {
      stopJobs();
      realtime.getIo()?.emit('server:shutdown', { reconnectInMs: 2000 });
      await io.close(); // closes websocket connections and the underlying http server
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
}

process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  process.exit(1);
});

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
