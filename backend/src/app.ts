import compression from 'compression';
import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins, env, isProd } from './config/env.js';
import type { Lifecycle } from './config/lifecycle.js';
import { buildOpenApi } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { readinessGate } from './middleware/readiness.js';
import { requestContext } from './middleware/requestContext.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { buildApiRouter } from './routes/index.js';

export interface AppOptions {
  /** When given, database-dependent requests are rejected with 503 until it reports ready (see readinessGate). */
  lifecycle?: Lifecycle;
}

export function createApp(opts: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  // Probes: no database, no rate limit, no auth. /healthz = liveness (process is up), /readyz = readiness.
  app.get('/healthz', (_req, res) => void res.status(200).json({ status: 'ok', uptimeSec: Math.round(process.uptime()) }));
  app.get('/readyz', (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    // Ready = initialisation finished AND the database is currently reachable (a replica without a DB must not get traffic).
    const ready = (opts.lifecycle ? opts.lifecycle.isReady : true) && dbUp;
    const phase = opts.lifecycle?.current ?? 'starting';
    const status = ready ? 'ready' : phase === 'ready' ? 'db_unavailable' : phase;
    res.status(ready ? 200 : 503).json({ status, db: dbUp ? 'up' : 'down' });
  });

  // Swagger UI needs inline scripts => its own relaxed helmet, mounted before the strict global one.
  const spec = buildOpenApi();
  app.get('/api/openapi.json', (_req, res) => void res.json(spec));
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Tic Tac Toe API' }));

  app.use(helmet());
  app.use(
    cors({
      // Native mobile clients send no Origin header; browsers must be on the allow-list.
      origin: (origin, cb) => cb(null, !origin || corsOrigins.includes('*') || corsOrigins.includes(origin)),
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(compression());
  app.use(requestContext);
  if (opts.lifecycle) app.use(readinessGate(opts.lifecycle));
  app.use(express.json({ limit: '100kb' }));
  app.use(sanitizeInput);
  app.use('/api/v1', globalLimiter, buildApiRouter());

  app.get('/', (_req, res) => void res.json({ name: 'tictactoe-api', docs: '/api/docs', health: '/api/v1/health', prod: isProd }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
