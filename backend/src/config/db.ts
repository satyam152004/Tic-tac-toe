import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

// Operator injection is prevented by the sanitize middleware + strict zod validation of every input.
mongoose.set('strictQuery', true);

export async function connectDb(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: true });
  logger.info('MongoDB connected');
  return conn;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

/** Build all indexes (used by tests and on startup so unique constraints are guaranteed). */
export async function syncIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}
