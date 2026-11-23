import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { BlockedUserModel, GameModel, MatchmakingTicketModel, TicketDoc, UserModel } from '../models/index.js';
import { createGameDoc, assertNoActiveOnlineGame, presentGame, randomMark, resolveConfig } from '../services/game.service.js';
import { notify } from '../services/notification.service.js';
import { CARD_FIELDS, toCard } from '../services/presenter.js';
import { realtime } from '../services/realtime.js';
import { Errors } from '../utils/errors.js';
import { addMs, DAY_MS } from '../utils/time.js';
import { otherMark } from '../game-engine/index.js';

/**
 * Quick matchmaking backed by MongoDB.
 *
 * Why this is safe with many backend instances (and needs no Redis for correctness):
 *  - a partial unique index guarantees at most ONE queued ticket per user,
 *  - an opponent is claimed with a single atomic findOneAndUpdate (QUEUED -> MATCHED),
 *    so one ticket can never be paired twice, even by concurrent requests on different nodes.
 * Redis (when REDIS_URL is set) is used for the Socket.IO adapter so the "found" events reach
 * players connected to any node.
 */

const ticketJson = (t: TicketDoc | Record<string, unknown>) => {
  const o = 'toJSON' in t ? (t as TicketDoc).toJSON() : t;
  return o;
};

export async function join(userId: string, input: { boardSize: number; winLength?: number }) {
  const config = resolveConfig(input.boardSize, input.winLength);
  const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } }).select('_id').lean();
  if (!user) throw Errors.notFound('Player not found');
  await assertNoActiveOnlineGame(userId);

  const now = new Date();
  // Housekeeping for this user: an overdue ticket must not block a fresh join.
  await MatchmakingTicketModel.updateMany({ userId, status: 'QUEUED', queueExpiresAt: { $lte: now } }, { $set: { status: 'EXPIRED' } });

  let ticket: TicketDoc;
  let alreadyQueued = false;
  try {
    const expires = addMs(now, env.MATCH_QUEUE_TTL_SEC * 1000);
    ticket = await MatchmakingTicketModel.create({
      userId,
      boardSize: config.size,
      winLength: config.winLength,
      status: 'QUEUED',
      queueExpiresAt: expires,
      purgeAt: addMs(expires, DAY_MS),
    });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    const existing = await MatchmakingTicketModel.findOne({ userId, status: 'QUEUED' });
    if (!existing) throw err;
    ticket = existing;
    alreadyQueued = true; // duplicate join: idempotent, never a second queue entry
  }
  const payload = { ticket: ticketJson(ticket), alreadyQueued };
  realtime.emitToUser(userId, 'matchmaking:queued', payload);

  const game = await tryMatch(ticket);
  if (game) return { status: 'MATCHED' as const, ticket: ticketJson(await MatchmakingTicketModel.findById(ticket._id).orFail()), game };
  return { status: 'QUEUED' as const, ticket: payload.ticket, alreadyQueued };
}

/** Attempts to pair `ticket` with the oldest compatible queued ticket. Returns the created game (or null). */
export async function tryMatch(ticket: TicketDoc): Promise<ReturnType<typeof presentGame> | null> {
  const me = ticket.userId;
  const [blockedBy, blocking] = await Promise.all([
    BlockedUserModel.find({ blockedId: me }).distinct('blockerId'),
    BlockedUserModel.find({ blockerId: me }).distinct('blockedId'),
  ]);
  const now = new Date();
  const opponent = await MatchmakingTicketModel.findOneAndUpdate(
    {
      status: 'QUEUED',
      boardSize: ticket.boardSize,
      winLength: ticket.winLength,
      userId: { $nin: [me, ...blockedBy, ...blocking] },
      queueExpiresAt: { $gt: now },
    },
    { $set: { status: 'MATCHED', matchedAt: now } },
    { sort: { createdAt: 1 }, new: true },
  );
  if (!opponent) return null;

  const mine = await MatchmakingTicketModel.findOneAndUpdate({ _id: ticket._id, status: 'QUEUED' }, { $set: { status: 'MATCHED', matchedAt: now } }, { new: true });
  if (!mine) {
    // Somebody else claimed (or the user cancelled) my ticket in the meantime: give the opponent back.
    try {
      await MatchmakingTicketModel.updateOne({ _id: opponent._id, status: 'MATCHED', gameId: null }, { $set: { status: 'QUEUED' }, $unset: { matchedAt: 1 } });
    } catch {
      await MatchmakingTicketModel.updateOne({ _id: opponent._id }, { $set: { status: 'CANCELLED' } });
    }
    return null;
  }

  const mark = randomMark();
  const game = await createGameDoc({
    type: 'ONLINE_RANDOM',
    config: { size: ticket.boardSize as 3 | 4 | 5, winLength: ticket.winLength },
    humans: [
      { userId: me, mark },
      { userId: opponent.userId, mark: otherMark(mark) },
    ],
    status: 'READY', // becomes IN_PROGRESS when both players have joined the game room
  });
  await MatchmakingTicketModel.updateMany({ _id: { $in: [mine._id, opponent._id] } }, { $set: { gameId: game._id } });

  const users = await UserModel.find({ _id: { $in: [me, opponent.userId] } }).select(CARD_FIELDS).lean();
  const card = (id: Types.ObjectId) => {
    const u = users.find((x) => String(x._id) === String(id));
    return u ? toCard(u) : null;
  };
  const presented = presentGame(game);
  for (const [uid, oppId] of [
    [me, opponent.userId],
    [opponent.userId, me],
  ] as const) {
    // The server places both players into the game room; clients then confirm with game:join.
    realtime.joinUserTo(uid, `game:${game._id}`);
    realtime.emitToUser(uid, 'matchmaking:found', { gameId: String(game._id), game: presented, opponent: card(oppId) });
    void notify(uid, { type: 'MATCH_FOUND', title: 'Match found', body: 'Your match is ready. Tap to play.', data: { gameId: String(game._id) } });
  }
  logger.info({ gameId: String(game._id) }, 'match created');
  return presented;
}

export async function cancel(userId: string) {
  const t = await MatchmakingTicketModel.findOneAndUpdate({ userId, status: 'QUEUED' }, { $set: { status: 'CANCELLED' } }, { new: true });
  if (t) realtime.emitToUser(userId, 'matchmaking:cancelled', { reason: 'CANCELLED' });
  return { cancelled: Boolean(t) };
}

export async function status(userId: string) {
  const [ticket, active] = await Promise.all([
    MatchmakingTicketModel.findOne({ userId, status: 'QUEUED', queueExpiresAt: { $gt: new Date() } }),
    GameModel.findOne({ playerIds: userId, status: { $in: ['WAITING', 'READY', 'IN_PROGRESS'] }, type: { $ne: 'AI' } }).lean(),
  ]);
  return {
    queued: Boolean(ticket),
    ticket: ticket ? ticket.toJSON() : null,
    queuedForSec: ticket ? Math.round((Date.now() - new Date(ticket.createdAt as unknown as Date).getTime()) / 1000) : 0,
    activeGameId: active ? String(active._id) : null,
  };
}

/** Periodic job: expire stale tickets and retry matching for tickets that were queued simultaneously. */
export async function sweep(): Promise<{ expired: number; matched: number }> {
  const now = new Date();
  const stale = await MatchmakingTicketModel.find({ status: 'QUEUED', queueExpiresAt: { $lte: now } }).limit(500);
  let expired = 0;
  for (const t of stale) {
    const r = await MatchmakingTicketModel.updateOne({ _id: t._id, status: 'QUEUED' }, { $set: { status: 'EXPIRED' } });
    if (r.modifiedCount) {
      expired++;
      realtime.emitToUser(t.userId, 'matchmaking:cancelled', { reason: 'EXPIRED' });
    }
  }
  let matched = 0;
  const queued = await MatchmakingTicketModel.find({ status: 'QUEUED' }).sort({ createdAt: 1 }).limit(100);
  for (const t of queued) {
    const fresh = await MatchmakingTicketModel.findOne({ _id: t._id, status: 'QUEUED' });
    if (fresh && (await tryMatch(fresh))) matched++;
  }
  return { expired, matched };
}
