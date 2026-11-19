import mongoose from 'mongoose';
import { env, isProd } from './env.js';
import { logger } from './logger.js';

// Operator injection is prevented by the sanitize middleware + strict zod validation of every input.
mongoose.set('strictQuery', true);

export async function connectDb(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    maxPoolSize: 20,
    // Model.init() (used by syncIndexes) only builds indexes when autoIndex is on. It never drops or rebuilds one.
    autoIndex: true,
  });
  logger.info('MongoDB connected');
  return conn;
}

/**
 * Initial connection with backoff. A failed first attempt (Atlas cold start, DNS, IP allow-list not yet propagated)
 * must not kill the process: the HTTP server is already up and reports `starting` until this resolves.
 */
export async function connectDbWithRetry(opts: { uri?: string; maxDelayMs?: number; onAttemptFailed?: (err: Error, attempt: number, nextDelayMs: number) => void; signal?: AbortSignal } = {}): Promise<typeof mongoose> {
  const maxDelay = opts.maxDelayMs ?? 15_000;
  for (let attempt = 1; ; attempt++) {
    try {
      return await connectDb(opts.uri);
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      const delay = Math.min(1_000 * 2 ** (attempt - 1), maxDelay);
      logger.error({ err: (err as Error).message, attempt, retryInMs: delay }, 'MongoDB connection failed, retrying');
      opts.onAttemptFailed?.(err as Error, attempt, delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export interface IndexSyncResult {
  failed: Array<{ model: string; error: string }>;
}

/**
 * Builds every index declared in the schemas. `Model.init()` only ever CREATES missing indexes: it never drops or
 * rebuilds one, so existing production indexes are untouched and this is a fast no-op once they exist. Changing an
 * index definition must be done by an operator (a conflicting definition is reported here, never "fixed" by dropping).
 *
 * Outside production a failure throws (tests/dev must have their unique constraints). In production a failure on one
 * model is logged loudly and does not take the whole service down.
 */
export async function syncIndexes(): Promise<IndexSyncResult> {
  const failed: IndexSyncResult['failed'] = [];
  await Promise.all(
    Object.values(mongoose.models).map(async (m) => {
      try {
        await m.init();
      } catch (err) {
        failed.push({ model: m.modelName, error: (err as Error).message });
      }
    }),
  );
  if (failed.length) {
    logger.error({ failed }, 'Some indexes could not be built (existing indexes were left untouched)');
    if (!isProd) throw new Error(`Index build failed: ${failed.map((f) => `${f.model}: ${f.error}`).join('; ')}`);
  }
  return { failed };
}
