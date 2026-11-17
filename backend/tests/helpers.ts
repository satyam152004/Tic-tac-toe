import type { AddressInfo } from 'node:net';
import { createServer, Server as HttpServer } from 'node:http';
import { Express } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import type { Server } from 'socket.io';

import { createApp } from '../src/app.js';
import { connectDb, disconnectDb, syncIndexes } from '../src/config/db.js';
import { seedAchievements } from '../src/services/achievement.service.js';
import { realtime } from '../src/services/realtime.js';
import { createSocketServer } from '../src/sockets/index.js';

export interface Env {
  app: Express;
  http: HttpServer;
  io: Server;
  url: string;
  mongod: MongoMemoryServer;
}

export async function startEnv(): Promise<Env> {
  const mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri('tictactoe_test'));
  await syncIndexes();
  await seedAchievements();
  const app = createApp();
  const http = createServer(app);
  const io = createSocketServer(http, null);
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  return { app, http, io, url, mongod };
}

export async function stopEnv(env: Env): Promise<void> {
  realtime.setIo(null);
  await new Promise<void>((r) => {
    void env.io.close(() => r());
  });
  await disconnectDb();
  await env.mongod.stop();
}

/** Empties every collection except the achievement catalogue (keeps indexes). */
export async function clearDb(): Promise<void> {
  const cols = await mongoose.connection.db!.collections();
  await Promise.all(cols.filter((c) => c.collectionName !== 'achievements').map((c) => c.deleteMany({})));
}

export interface TestUser {
  id: string;
  token: string;
  refreshToken: string;
  username: string;
}

let counter = 0;
export async function registerUser(app: Express, name = `user${++counter}`): Promise<TestUser> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email: `${name}@example.com`, password: 'Passw0rdOK', username: name });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: res.body.data.user.id, token: res.body.data.tokens.accessToken, refreshToken: res.body.data.tokens.refreshToken, username: name };
}

export const auth = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });

// -------------------------------------------------------------- sockets
export interface TestSocket {
  raw: ClientSocket;
  /** Resolves with the next payload of `event` (events seen before the call are NOT replayed). */
  next<T = any>(event: string, timeoutMs?: number): Promise<T>;
  /** Wait for an event whose payload satisfies the predicate (buffered events included). */
  waitFor<T = any>(event: string, pred?: (p: T) => boolean, timeoutMs?: number, onlyNew?: boolean): Promise<T>;
  emit<T = any>(event: string, payload?: unknown): Promise<{ ok: boolean; data?: T; error?: { code: string; message: string } }>;
  history: Array<{ event: string; payload: any }>;
  close(): void;
}

export function connectSocket(url: string, token: string | undefined): Promise<TestSocket> {
  return new Promise((resolve, reject) => {
    const raw = ioClient(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false, forceNew: true });
    const history: Array<{ event: string; payload: any }> = [];
    const waiters: Array<{ event: string; pred: (p: any) => boolean; resolve: (p: any) => void }> = [];
    raw.onAny((event, payload) => {
      history.push({ event, payload });
      for (let i = waiters.length - 1; i >= 0; i--) {
        const w = waiters[i]!;
        if (w.event === event && w.pred(payload)) {
          waiters.splice(i, 1);
          w.resolve(payload);
        }
      }
    });
    const api: TestSocket = {
      raw,
      history,
      next: (event, timeoutMs = 5000) => api.waitFor(event, () => true, timeoutMs, true),
      waitFor: (event: string, pred: (p: any) => boolean = () => true, timeoutMs = 5000, onlyNew = false) =>
        new Promise((res, rej) => {
          if (!onlyNew) {
            const hit = history.find((h) => h.event === event && pred(h.payload));
            if (hit) return res(hit.payload);
          }
          const timer = setTimeout(() => rej(new Error(`timeout waiting for ${event}`)), timeoutMs);
          waiters.push({ event, pred, resolve: (p) => (clearTimeout(timer), res(p)) });
        }),
      emit: (event, payload) =>
        new Promise((res, rej) => {
          const timer = setTimeout(() => rej(new Error(`ack timeout for ${event}`)), 5000);
          raw.emit(event, payload, (r: any) => {
            clearTimeout(timer);
            res(r);
          });
        }),
      close: () => void raw.close(),
    } as TestSocket;
    // Resolve once the server finished its async session setup (rooms joined, state resumed).
    raw.on('session:ready', () => resolve(api));
    raw.on('connect_error', (err) => reject(Object.assign(err, { data: (err as any).data })));
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Plays moves for alternating players on a started game via REST. */
export async function playMoves(app: Express, gameId: string, seq: Array<[TestUser, number]>) {
  let last;
  for (const [u, pos] of seq) {
    last = await request(app).post(`/api/v1/games/${gameId}/moves`).set(auth(u)).send({ position: pos });
    if (last.status !== 200) throw new Error(`move ${pos} by ${u.username} failed ${last.status}: ${JSON.stringify(last.body)}`);
  }
  return last!;
}

/** Quick-match two users over REST and start the game; returns the game plus who is X/O. */
export async function startOnlineGame(app: Express, a: TestUser, b: TestUser, size = 3) {
  await request(app).post('/api/v1/matchmaking/join').set(auth(a)).send({ boardSize: size });
  const res = await request(app).post('/api/v1/matchmaking/join').set(auth(b)).send({ boardSize: size });
  if (res.body.data?.status !== 'MATCHED') throw new Error('not matched: ' + JSON.stringify(res.body));
  const gameId = res.body.data.game.id as string;
  await request(app).post(`/api/v1/games/${gameId}/join`).set(auth(a));
  const started = await request(app).post(`/api/v1/games/${gameId}/join`).set(auth(b));
  const players = started.body.data.players as Array<{ userId: string; mark: 'X' | 'O' }>;
  const x = players.find((p) => p.mark === 'X')!.userId === a.id ? a : b;
  const o = x === a ? b : a;
  return { gameId, x, o, game: started.body.data };
}
