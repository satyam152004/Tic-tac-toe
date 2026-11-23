import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { corsOrigins, env } from '../config/env.js';
import { logger } from '../config/logger.js';
import * as mm from '../matchmaking/matchmaking.service.js';
import { FriendshipModel, UserModel } from '../models/index.js';
import * as games from '../services/game.service.js';
import { realtime } from '../services/realtime.js';
import * as rooms from '../services/room.service.js';
import { Errors } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/tokens.js';
import * as gv from '../validators/game.validator.js';
import * as sv from '../validators/social.validator.js';
import { objectId } from '../validators/common.js';
import { registerEvent, socketRate } from './events/register.js';

const gameRef = z.object({ gameId: objectId });
const moveEvent = gameRef.extend({ position: z.number().int().min(0).max(24), clientMoveId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/).optional(), expectedMoveNumber: z.number().int().min(1).max(25).optional() });
const cheerEvent = gameRef.extend({ kind: z.enum(['clap', 'fire', 'wow']) });
const roomRef = z.object({ roomId: objectId });
const readyEvent = roomRef.extend({ ready: z.boolean() });

async function friendIds(userId: string): Promise<string[]> {
  const rel = await FriendshipModel.find({ status: 'ACCEPTED', $or: [{ requesterId: userId }, { recipientId: userId }] }).select('requesterId recipientId').lean();
  return rel.map((r) => (String(r.requesterId) === userId ? String(r.recipientId) : String(r.requesterId)));
}

export function createSocketServer(httpServer: HttpServer, redis?: { pub: Redis; sub: Redis } | null): Server {
  const io = new Server(httpServer, {
    cors: { origin: (origin, cb) => cb(null, !origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) },
    pingInterval: 10_000,
    pingTimeout: 10_000,
    maxHttpBufferSize: 100_000,
    transports: ['websocket', 'polling'],
  });
  if (redis) io.adapter(createAdapter(redis.pub, redis.sub));
  realtime.setIo(io);

  // ---------------------------------------------------------------- authentication (every connection)
  io.use(async (socket, next) => {
    try {
      const raw = (socket.handshake.auth as { token?: string } | undefined)?.token ?? socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!raw || typeof raw !== 'string') throw Errors.unauthorized('Sign in first.');
      const claims = verifyAccessToken(raw);
      const user = await UserModel.findOne({ _id: claims.sub, deletedAt: { $exists: false } }).select('_id').lean();
      if (!user) throw Errors.unauthorized('Account not found', 'INVALID_TOKEN');
      socket.data.userId = claims.sub;
      socket.data.sessionId = claims.sid;
      next();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const error = new Error(e.message ?? 'Unauthorized') as Error & { data?: unknown };
      error.data = { code: e.code ?? 'UNAUTHORIZED' }; // clients refresh the token on TOKEN_EXPIRED then reconnect
      next(error);
    }
  });

  io.on('connection', (socket) => void onConnection(io, socket));
  return io;
}

async function onConnection(io: Server, socket: Socket): Promise<void> {
  const userId = socket.data.userId as string;

  // 1) Register every handler SYNCHRONOUSLY: a client may emit the instant it is connected, and an
  //    event arriving before its handler exists would be silently dropped.
  const bucket = socketRate();
  const reg = <T>(event: string, schema: z.ZodType<T> | null, handler: (uid: string, p: T, s: Socket) => unknown, withReject = false) =>
    registerEvent(socket, bucket, event, schema, handler, withReject ? (err, payload) => {
      // Dedicated rejection event so UIs can roll back optimistic moves.
      const p = (payload ?? {}) as { gameId?: string; clientMoveId?: string; position?: number };
      socket.emit('game:move-rejected', { gameId: p.gameId, clientMoveId: p.clientMoveId, position: p.position, code: err.code, message: err.message, details: err.details });
    } : undefined);

  reg('matchmaking:join', sv.matchmakingJoinBody, (uid, p) => mm.join(uid, p));
  reg('matchmaking:cancel', null, (uid) => mm.cancel(uid));

  reg('game:join', gameRef, async (uid, p, s) => {
    const game = await games.joinGame(uid, p.gameId); // verifies membership, then adds all the user's sockets to game:<id>
    await s.join(`game:${p.gameId}`);
    s.emit('game:updated', { game, resumed: true });
    return game;
  });
  // Friends watching a live game (read-only): joins spectate:<id>, receives every game event the players do.
  const publishSpectators = async (gameId: string) => realtime.emitToGame(gameId, 'game:spectators', { gameId, count: await games.spectatorCount(gameId) });
  reg('game:spectate', gameRef, async (uid, p, s) => {
    const snapshot = await games.spectate(uid, p.gameId);
    await s.join(`spectate:${p.gameId}`);
    s.data.spectating = [...new Set([...((s.data.spectating as string[] | undefined) ?? []), p.gameId])];
    const count = await games.spectatorCount(p.gameId);
    realtime.emitToGame(p.gameId, 'game:spectators', { gameId: p.gameId, count });
    return { ...snapshot, spectators: count };
  });
  reg('game:unspectate', gameRef, async (_uid, p, s) => {
    await s.leave(`spectate:${p.gameId}`);
    s.data.spectating = ((s.data.spectating as string[] | undefined) ?? []).filter((id) => id !== p.gameId);
    await publishSpectators(p.gameId);
    return { left: true };
  });
  reg('game:cheer', cheerEvent, async (uid, p, s) => {
    if (!s.rooms.has(`spectate:${p.gameId}`)) throw Errors.forbidden('Start watching the match first.', 'NOT_SPECTATING');
    realtime.emitToGame(p.gameId, 'game:cheer', { gameId: p.gameId, kind: p.kind, userId: uid });
    return { sent: true };
  });
  reg('game:move', moveEvent, (uid, p) => games.makeMove(uid, p.gameId, p), true);
  reg('game:forfeit', gameRef, (uid, p) => games.forfeit(uid, p.gameId));
  reg('game:offer-draw', gameRef, (uid, p) => games.offerDraw(uid, p.gameId));
  reg('game:respond-draw', gameRef.extend({ accept: z.boolean() }), (uid, p) => games.respondDraw(uid, p.gameId, p.accept));
  reg('game:rematch', gameRef, (uid, p) => games.requestRematch(uid, p.gameId));

  reg('room:create', sv.roomCreateBody, (uid, p) => rooms.create(uid, p));
  reg('room:join', sv.roomJoinBody, (uid, p) => rooms.join(uid, p.code));
  reg('room:leave', roomRef, (uid, p) => rooms.leave(uid, p.roomId));
  reg('room:ready', readyEvent, (uid, p) => rooms.setReady(uid, p.roomId, p.ready));
  reg('room:start', roomRef, (uid, p) => rooms.start(uid, p.roomId));

  reg('player:heartbeat', null, async (uid) => {
    await UserModel.updateOne({ _id: uid }, { $set: { online: true, lastActiveAt: new Date() } });
    return { serverTime: new Date().toISOString() };
  });

  socket.on('disconnecting', () => {
    // rooms are already being left when `disconnect` fires; refresh the spectator count shortly after.
    for (const id of (socket.data.spectating as string[] | undefined) ?? []) setTimeout(() => void games.spectatorCount(id).then((count) => realtime.emitToGame(id, 'game:spectators', { gameId: id, count })).catch(() => undefined), 50);
  });

  socket.on('disconnect', async () => {
    try {
      const remaining = await io.in(`user:${userId}`).fetchSockets();
      if (remaining.length > 0) return; // still connected on another device/tab
      await UserModel.updateOne({ _id: userId }, { $set: { online: false, lastActiveAt: new Date() } });
      for (const fid of await friendIds(userId)) io.to(`user:${fid}`).emit('player:disconnected', { userId });
      await games.markConnection(userId, false);
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'disconnect handler failed');
    }
  });

  // 2) Async session setup.
  try {
    await socket.join(`user:${userId}`);
    const sockets = await io.in(`user:${userId}`).fetchSockets();
    const firstSocket = sockets.length <= 1;

    await UserModel.updateOne({ _id: userId }, { $set: { online: true, lastActiveAt: new Date() } });
    if (firstSocket) {
      for (const fid of await friendIds(userId)) io.to(`user:${fid}`).emit('player:connected', { userId });
      await games.markConnection(userId, true).catch((err: Error) => logger.error({ err: err.message }, 'markConnection(true) failed'));
    }

    // Reconnection: put the socket back in its game channels and replay the latest authoritative state.
    const active = await games.resumeGames(userId);
    for (const g of active) await socket.join(`game:${g.id}`);
    socket.emit('session:ready', { userId, serverTime: new Date().toISOString(), activeGames: active });
    for (const g of active) socket.emit('game:updated', { game: g, resumed: true });
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'socket session setup failed');
    socket.disconnect(true);
  }
}

export { gv };
export const SOCKET_EVENT_RATE = env.SOCKET_EVENTS_PER_SEC;
