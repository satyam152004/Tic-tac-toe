/**
 * Starts a throwaway in-memory MongoDB on 127.0.0.1:27017 for local development when you do not have
 * MongoDB installed (data is lost when the process stops). Usage: npm run dev:mongo
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const port = Number(process.env.DEV_MONGO_PORT ?? 27017);
const server = await MongoMemoryServer.create({ instance: { port, ip: '127.0.0.1' } });
console.log(`In-memory MongoDB ready: ${server.getUri('tictactoe')}`);
const stop = async () => {
  await server.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => undefined, 1 << 30);
