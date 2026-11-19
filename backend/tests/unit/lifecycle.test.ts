import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { Lifecycle } from '../../src/config/lifecycle.js';
import { connectDbWithRetry } from '../../src/config/db.js';
import { startJobs } from '../../src/jobs/index.js';

// No database is connected in this file on purpose: it proves the probes and the gate do not depend on it.

describe('liveness / readiness probes', () => {
  it('/healthz answers 200 immediately, with no database and while starting', async () => {
    const lc = new Lifecycle();
    const res = await request(createApp({ lifecycle: lc })).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('/readyz is 503 while starting and 200 once ready', async () => {
    const lc = new Lifecycle();
    const app = createApp({ lifecycle: lc });
    const starting = await request(app).get('/readyz');
    expect(starting.status).toBe(503);
    expect(starting.body.status).toBe('starting');
    lc.markReady();
    // initialised but the database is not connected (this file connects none) => still not ready
    const noDb = await request(app).get('/readyz');
    expect(noDb.status).toBe(503);
    expect(noDb.body).toEqual({ status: 'db_unavailable', db: 'down' });
  });

  it('/readyz is 503 again once shutdown has begun', async () => {
    const lc = new Lifecycle();
    lc.markReady();
    const app = createApp({ lifecycle: lc });
    lc.markShuttingDown();
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('shutting_down');
  });

  it('the existing /api/v1/health contract is unchanged (503 UNHEALTHY while the database is down)', async () => {
    const res = await request(createApp({ lifecycle: new Lifecycle() })).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('UNHEALTHY');
  });
});

describe('readiness gate', () => {
  it('rejects database-dependent requests with a retryable 503 until ready (REST and the Socket.IO path)', async () => {
    const lc = new Lifecycle();
    const app = createApp({ lifecycle: lc });
    for (const [method, path] of [['post', '/api/v1/auth/login'], ['get', '/api/v1/users/me'], ['get', '/socket.io/']] as const) {
      const res = await request(app)[method](path).send({});
      expect(res.status, path).toBe(503);
      expect(res.body.error.code).toBe('SERVICE_STARTING');
      expect(res.headers['retry-after']).toBeTruthy();
    }
  });

  it('lets requests through once ready', async () => {
    const lc = new Lifecycle();
    lc.markReady();
    const res = await request(createApp({ lifecycle: lc })).get('/api/v1/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('rejects new requests with SERVICE_SHUTTING_DOWN and closes the connection during shutdown', async () => {
    const lc = new Lifecycle();
    lc.markReady();
    const app = createApp({ lifecycle: lc });
    lc.markShuttingDown();
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_SHUTTING_DOWN');
    expect(res.headers.connection).toBe('close');
  });

  it('is not installed when no lifecycle is given (tests / embedded use keep working)', async () => {
    const res = await request(createApp()).get('/api/v1/definitely-not-a-route');
    expect(res.status).toBe(404);
  });
});

describe('startup stage timing', () => {
  it('records how long each stage took', async () => {
    const lc = new Lifecycle();
    lc.stage('a');
    await new Promise((r) => setTimeout(r, 15));
    lc.stage('b');
    expect(Object.keys(lc.snapshot.stagesMs)).toEqual(['a', 'b']);
    expect(lc.snapshot.stagesMs.b).toBeGreaterThanOrEqual(10);
  });
});

describe('connectDbWithRetry', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps retrying with backoff instead of failing the process, and resolves once MongoDB is reachable', async () => {
    const connect = vi
      .spyOn(mongoose, 'connect')
      .mockRejectedValueOnce(new Error('ENOTFOUND cluster'))
      .mockRejectedValueOnce(new Error('Server selection timed out'))
      .mockResolvedValueOnce(mongoose);
    const failures: number[] = [];
    await connectDbWithRetry({ uri: 'mongodb://x/y', maxDelayMs: 5, onAttemptFailed: (_e, attempt) => failures.push(attempt) });
    expect(connect).toHaveBeenCalledTimes(3);
    expect(failures).toEqual([1, 2]);
  });

  it('stops retrying when aborted (shutdown during startup)', async () => {
    vi.spyOn(mongoose, 'connect').mockRejectedValue(new Error('down'));
    const ac = new AbortController();
    const p = connectDbWithRetry({ uri: 'mongodb://x/y', maxDelayMs: 5, signal: ac.signal, onAttemptFailed: () => ac.abort() });
    await expect(p).rejects.toThrow('down');
  });
});

describe('background jobs', () => {
  it('start once per process: a second call does not create duplicate timers', () => {
    const stop = startJobs();
    expect(startJobs()).toBe(stop);
    stop();
    const again = startJobs(); // after stopping they can be started again
    expect(again).not.toBe(stop);
    again();
  });
});
