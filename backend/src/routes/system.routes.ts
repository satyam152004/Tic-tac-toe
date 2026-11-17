import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { AppError } from '../utils/errors.js';
import { route } from './registry.js';

let pkg: { name: string; version: string } = { name: 'tictactoe-backend', version: '0.0.0' };
try {
  pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
} catch {
  /* package.json not found next to the compiled output; keep defaults */
}

export const systemRoutes = [
  route({
    method: 'get',
    path: '/health',
    tag: 'System',
    summary: 'Liveness/readiness probe (fails with 503 when MongoDB is down)',
    auth: 'none',
    response: '{ status, db, uptimeSec, timestamp }',
    handler: () => {
      const dbUp = mongoose.connection.readyState === 1;
      if (!dbUp) throw new AppError(503, 'UNHEALTHY', 'Database not connected');
      return { status: 'ok', db: 'up', uptimeSec: Math.round(process.uptime()), timestamp: new Date().toISOString() };
    },
  }),
  route({
    method: 'get',
    path: '/version',
    tag: 'System',
    summary: 'API version information',
    auth: 'none',
    response: '{ name, version, apiVersion, node }',
    handler: () => ({ name: pkg.name, version: pkg.version, apiVersion: 'v1', node: process.version }),
  }),
];
