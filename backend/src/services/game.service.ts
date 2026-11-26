import { randomInt } from 'node:crypto';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ACTIVE_GAME_STATUSES } from '../constants/index.js';
import {
  applyMove,
  assertValidConfig,
  BoardConfig,
  BoardSize,
  Cell,
  chooseMove,
  createBoard,
  defaultWinLength,
  Difficulty,
  Mark,
  MoveError,
  otherMark,
} from '../game-engine/index.js';
import { FirstMovePref, markFor } from './firstMove.js';
import { BlockedUserModel, FriendshipModel, GameAttrs, GameModel, makePairKey, MoveModel, RoomModel, UserModel } from '../models/index.js';
import { AppError, Errors } from '../utils/errors.js';
import { CARD_FIELDS, toCard } from './presenter.js';
import { addMs, DAY_MS } from '../utils/time.js';
import { canAfford, chargeEntry, refundEntry } from './coin.service.js';
import { finalizeGame } from './finalize.service.js';
import { notify } from './notification.service.js';
import { realtime } from './realtime.js';

export type G = GameAttrs & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date };

const RETAIN_FINISHED_MS = 365 * DAY_MS;
const RETAIN_CANCELLED_MS = 1 * DAY_MS;
const ONLINE_TYPES = ['ONLINE_RANDOM', 'PRIVATE_ROOM', 'FRIEND'] as const;

// ------------------------------------------------------------------ presentation

export function presentGame(g: G) {
  return {
    id: String(g._id),
    type: g.type,
    status: g.status,
    boardSize: g.boardSize,
    winLength: g.winLength,
    board: g.board,
    currentTurn: g.currentTurn,
    moveCount: g.moveCount,
    players: g.players.map((p) => ({ userId: p.userId ? String(p.userId) : null, mark: p.mark, isAI: p.isAI, joined: Boolean(p.joinedAt), outcome: p.outcome ?? null, pointsAwarded: p.pointsAwarded ?? 0 })),
    difficulty: g.difficulty ?? null,
    roomId: g.roomId ? String(g.roomId) : null,
    entryAmount: g.entryAmount ?? 0,
    turnTimeoutSec: g.turnTimeoutSec,
    turnDeadline: g.turnDeadline ?? null,
    startedAt: g.startedAt ?? null,
    endedAt: g.endedAt ?? null,
    durationMs: g.durationMs ?? null,
    result: g.result
      ? { winner: g.result.winner ?? null, winnerId: g.result.winnerId ? String(g.result.winnerId) : null, line: g.result.line ?? [], reason: g.result.reason ?? null }
      : null,
    drawOffer: g.drawOffer?.by && g.drawOffer.expiresAt && new Date(g.drawOffer.expiresAt).getTime() > Date.now() ? { by: String(g.drawOffer.by), expiresAt: g.drawOffer.expiresAt } : null,
    rematch: { requestedBy: (g.rematchRequestedBy ?? []).map(String), gameId: g.rematchGameId ? String(g.rematchGameId) : null },
    previousGameId: g.previousGameId ? String(g.previousGameId) : null,
    createdAt: g.createdAt,
    serverTime: new Date().toISOString(),
  };
}

async function playerCards(g: G) {
  const ids = g.players.filter((p) => p.userId).map((p) => p.userId!);
  const users = await UserModel.find({ _id: { $in: ids } }).select(CARD_FIELDS).lean();
  const byId = new Map(users.map((u) => [String(u._id), toCard(u)]));
  return g.players.map((p) => ({ mark: p.mark, isAI: p.isAI, user: p.userId ? (byId.get(String(p.userId)) ?? null) : null }));
}

const memberOf = (g: G, userId: string) => g.playerIds.some((id) => String(id) === userId);
const markOf = (g: G, userId: string): Mark | null => (g.players.find((p) => p.userId && String(p.userId) === userId)?.mark as Mark | undefined) ?? null;

async function loadGame(gameId: string): Promise<G> {
  const g = (await GameModel.findById(gameId).lean()) as G | null;
  if (!g) throw Errors.notFound('Game not found', 'GAME_NOT_FOUND');
  return g;
}

/**
 * Read-only access to a running online game for an accepted friend of one of its human players
 * (that player must allow spectating). Returns the state plus both player cards.
 */
export async function spectate(viewerId: string, gameId: string) {
  const g = await loadGame(gameId);
  if (memberOf(g, viewerId)) throw Errors.badRequest('You\'re already playing in this match.', 'ALREADY_A_PLAYER');
  if (!ONLINE_TYPES.includes(g.type as (typeof ONLINE_TYPES)[number]) || g.status !== 'IN_PROGRESS') {
    throw Errors.conflict('This match isn\'t live.', 'GAME_NOT_LIVE');
  }
  const humans = g.players.filter((p) => p.userId).map((p) => p.userId!);
  const friendships = await FriendshipModel.find({
    status: 'ACCEPTED',
    $or: humans.flatMap((h) => [{ requesterId: viewerId, recipientId: h }, { requesterId: h, recipientId: viewerId }]),
  }).select('requesterId recipientId').lean();
  const friendOf = new Set(friendships.map((f) => (String(f.requesterId) === viewerId ? String(f.recipientId) : String(f.requesterId))));
  if (friendOf.size === 0) throw Errors.forbidden('You can only watch your friends\' matches.', 'NOT_A_FRIEND');
  const owners = await UserModel.find({ _id: { $in: [...friendOf] } }).select('privacy').lean();
  if (!owners.some((u) => u.privacy?.allowSpectating !== false)) throw Errors.forbidden('Your friend doesn\'t allow watching.', 'SPECTATING_DISABLED');
  const blocked = await BlockedUserModel.exists({ $or: humans.flatMap((h) => [{ blockerId: h, blockedId: viewerId }, { blockerId: viewerId, blockedId: h }]) });
  if (blocked) throw Errors.forbidden('You cannot watch this match', 'BLOCKED');
  return { game: presentGame(g), players: await playerCards(g) };
}

export async function spectatorCount(gameId: string): Promise<number> {
  const io = realtime.getIo();
  return io ? (await io.in(`spectate:${gameId}`).fetchSockets()).length : 0;
}

async function loadMemberGame(userId: string, gameId: string): Promise<G> {
  const g = await loadGame(gameId);
  if (!memberOf(g, userId)) throw Errors.forbidden('You are not a player in this game', 'NOT_A_PLAYER');
  return g;
}

// ------------------------------------------------------------------ creation

export const randomMark = (): Mark => (randomInt(2) === 0 ? 'X' : 'O');

export function resolveConfig(boardSize: number, winLength?: number): BoardConfig {
  const cfg = { size: boardSize as BoardSize, winLength: winLength ?? defaultWinLength(boardSize as BoardSize) };
  try {
    assertValidConfig(cfg);
  } catch (e) {
    throw Errors.badRequest((e as Error).message, 'INVALID_BOARD_CONFIG');
  }
  return cfg;
}

export interface CreateGameInput {
  _id?: Types.ObjectId;
  type: (typeof import('../constants/index.js'))['GAME_TYPES'][number];
  config: BoardConfig;
  humans: Array<{ userId: Types.ObjectId | string; mark: Mark }>;
  status: 'WAITING' | 'READY' | 'IN_PROGRESS';
  difficulty?: Difficulty;
  roomId?: Types.ObjectId | string;
  createdBy?: Types.ObjectId | string;
  invitedUserId?: Types.ObjectId | string;
  previousGameId?: Types.ObjectId | string;
  /** Per-turn clock override (seconds, 0 = off). Defaults to the server turn timeout for human games. */
  turnTimeoutSec?: number;
  /** Coins each player paid to start (room matches only). */
  entryAmount?: number;
}

/** Single place that builds game documents (AI, matchmaking, rooms, friends, rematches). */
export async function createGameDoc(input: CreateGameInput): Promise<G> {
  const now = new Date();
  const started = input.status === 'IN_PROGRESS';
  const players: Array<Record<string, unknown>> = input.humans.map((h) => ({ userId: h.userId, mark: h.mark, isAI: false, joinedAt: started ? now : null }));
  if (input.type === 'AI') {
    const humanMark = input.humans[0]!.mark;
    players.push({ userId: null, mark: otherMark(humanMark), isAI: true, joinedAt: now });
  }
  const timeout = input.type === 'AI' ? 0 : input.turnTimeoutSec ?? env.TURN_TIMEOUT_SEC;
  const doc = await GameModel.create({
    ...(input._id ? { _id: input._id } : {}),
    type: input.type,
    status: input.status,
    boardSize: input.config.size,
    winLength: input.config.winLength,
    board: createBoard(input.config.size),
    currentTurn: 'X',
    players,
    playerIds: input.humans.map((h) => h.userId),
    difficulty: input.difficulty,
    roomId: input.roomId,
    entryAmount: input.entryAmount ?? 0,
    createdBy: input.createdBy ?? input.humans[0]?.userId,
    invitedUserId: input.invitedUserId ?? null,
    previousGameId: input.previousGameId ?? null,
    turnTimeoutSec: timeout,
    startedAt: started ? now : undefined,
    lastMoveAt: started ? now : undefined,
    turnDeadline: started && timeout > 0 ? addMs(now, timeout * 1000) : null,
  });
  return doc.toObject() as unknown as G;
}

/** An online player may only be in ONE active online game at a time. */
export async function assertNoActiveOnlineGame(userId: string | Types.ObjectId): Promise<void> {
  const g = await GameModel.findOne({ playerIds: userId, type: { $in: ONLINE_TYPES }, status: { $in: ACTIVE_GAME_STATUSES } }).select('_id').lean();
  if (g) throw Errors.conflict('You\'re already in a match.', 'ALREADY_IN_GAME', { gameId: String(g._id) });
}

export async function areBlocked(a: string | Types.ObjectId, b: string | Types.ObjectId): Promise<boolean> {
  return Boolean(await BlockedUserModel.exists({ $or: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }));
}

export async function createAiGame(
  userId: string,
  input: { boardSize: number; winLength?: number; difficulty: Difficulty; humanMark?: 'X' | 'O' | 'RANDOM' },
) {
  const config = resolveConfig(input.boardSize, input.winLength);
  // Starting a new AI game abandons the player's previous unfinished AI games (not counted in stats).
  await GameModel.updateMany(
    { playerIds: userId, type: 'AI', status: { $in: ACTIVE_GAME_STATUSES } },
    { $set: { status: 'CANCELLED', endedAt: new Date(), turnDeadline: null, purgeAt: addMs(new Date(), RETAIN_CANCELLED_MS) } },
  );
  const humanMark: Mark = input.humanMark && input.humanMark !== 'RANDOM' ? input.humanMark : randomMark();
  let game = await createGameDoc({ type: 'AI', config, humans: [{ userId, mark: humanMark }], status: 'IN_PROGRESS', difficulty: input.difficulty });
  if (humanMark === 'O') game = (await playAiTurn(String(game._id))) ?? game; // AI is X and moves first
  realtime.joinUserTo(userId, `game:${game._id}`);
  return presentGame(game);
}

export async function createFriendGame(userId: string, input: { opponentId: string; boardSize: number; winLength?: number; firstMove?: FirstMovePref; entryAmount?: number }) {
  if (input.opponentId === userId) throw Errors.badRequest('You cannot invite yourself', 'SELF_INVITE');
  const config = resolveConfig(input.boardSize, input.winLength);
  const friends = await FriendshipModel.exists({ pairKey: makePairKey(userId, input.opponentId), status: 'ACCEPTED' });
  if (!friends) throw Errors.forbidden('You can only invite friends', 'NOT_FRIENDS');
  if (await areBlocked(userId, input.opponentId)) throw Errors.forbidden('You can\'t do that.', 'BLOCKED');
  await assertNoActiveOnlineGame(userId);
  const entry = input.entryAmount ?? 0;
  if (!(await canAfford(userId, entry))) throw Errors.conflict('Not enough coins for this entry amount.', 'INSUFFICIENT_COINS');
  const me = await UserModel.findById(userId).select('displayName').lean();
  const game = await createGameDoc({
    type: 'FRIEND',
    config,
    humans: [{ userId, mark: markFor(input.firstMove ?? 'RANDOM', randomMark) }],
    status: 'WAITING',
    invitedUserId: input.opponentId,
    entryAmount: entry,
  });
  realtime.joinUserTo(userId, `game:${game._id}`);
  await notify(input.opponentId, {
    type: 'GAME_INVITE',
    title: 'Match invite',
    body: `${me?.displayName ?? 'A friend'} invited you to a ${config.size}x${config.size} match`,
    data: { gameId: String(game._id), fromUserId: userId },
  });
  return presentGame(game);
}

// ------------------------------------------------------------------ join / start

export async function joinGame(userId: string, gameId: string) {
  let g = await loadGame(gameId);
  // Invited friend accepting a WAITING friend game.
  if (g.status === 'WAITING' && g.type === 'FRIEND' && g.invitedUserId && String(g.invitedUserId) === userId && !memberOf(g, userId)) {
    await assertNoActiveOnlineGame(userId);
    const creatorMark = g.players[0]!.mark as Mark;
    // Paid invite: both entries are taken when the friend accepts. If the accept does not go through, they are returned.
    const entry = g.entryAmount ?? 0;
    const creatorId = String(g.createdBy ?? g.players[0]!.userId);
    if (entry > 0) await chargeEntry([creatorId, userId], entry, String(g._id));
    const updated = (await GameModel.findOneAndUpdate(
      { _id: g._id, status: 'WAITING', playerIds: { $ne: userId } },
      {
        $push: { players: { userId, mark: otherMark(creatorMark), isAI: false, joinedAt: new Date() }, playerIds: userId },
        $set: { status: 'READY' },
      },
      { new: true },
    ).lean()) as G | null;
    if (!updated && entry > 0) await refundEntry([creatorId, userId], entry, String(g._id));
    if (updated) {
      // The inviter is waiting on this game: tell them the friend has accepted (READY starts the countdown on both phones).
      realtime.emitToGame(g._id, 'game:updated', { game: presentGame(updated as G) });
      void notify(g.createdBy!, { type: 'OPPONENT_JOINED', title: 'Friend joined', body: 'Your friend accepted your invite.', data: { gameId } });
    }
    g = await loadGame(gameId);
  }
  if (!memberOf(g, userId)) throw Errors.forbidden('You are not a player in this game', 'NOT_A_PLAYER');

  if (g.status === 'READY' || g.status === 'IN_PROGRESS') {
    await GameModel.updateOne(
      { _id: g._id, players: { $elemMatch: { userId, joinedAt: null } } },
      { $set: { 'players.$.joinedAt': new Date() } },
    );
  }
  realtime.joinUserTo(userId, `game:${gameId}`);
  await startIfReady(gameId);
  return presentGame(await loadGame(gameId));
}

/** READY -> IN_PROGRESS once every human player has joined the game room. Exactly one caller wins. */
async function startIfReady(gameId: string): Promise<void> {
  const g = await loadGame(gameId);
  if (g.status !== 'READY' || g.players.length < 2 || !g.players.every((p) => p.isAI || p.joinedAt)) return;
  const now = new Date();
  const started = (await GameModel.findOneAndUpdate(
    { _id: g._id, status: 'READY' },
    {
      $set: {
        status: 'IN_PROGRESS',
        startedAt: now,
        lastMoveAt: now,
        turnDeadline: g.turnTimeoutSec > 0 ? addMs(now, g.turnTimeoutSec * 1000) : null,
      },
    },
    { new: true },
  ).lean()) as G | null;
  if (started) {
    realtime.emitToGame(started._id, 'game:started', { game: presentGame(started), players: await playerCards(started) });
    if (started.roomId) {
      await RoomModel.updateOne({ _id: started.roomId, gameId: started._id }, { $set: { status: 'PLAYING' } });
    }
  }
}

// ------------------------------------------------------------------ moves

function mapMoveError(e: unknown): never {
  if (e instanceof MoveError) {
    if (e.code === 'CELL_OCCUPIED') throw Errors.conflict('That square is taken.', 'CELL_OCCUPIED');
    if (e.code === 'CELL_OUT_OF_RANGE') throw Errors.badRequest('That square isn\'t on the board.', 'CELL_OUT_OF_RANGE');
    throw Errors.conflict('This match isn\'t active.', 'GAME_NOT_ACTIVE');
  }
  throw e;
}

class StaleGame extends Error {}

/**
 * Atomically applies one move. The single findOneAndUpdate is guarded by status, turn, empty cell AND
 * the previous move count, so two simultaneous submissions can never both succeed (one wins, the other
 * sees null => conflict). Win/draw is decided in the same atomic write.
 */
async function commitMove(game: G, mark: Mark, playerId: Types.ObjectId | null, position: number, clientMoveId?: string) {
  const cfg: BoardConfig = { size: game.boardSize as BoardSize, winLength: game.winLength };
  let outcome;
  try {
    outcome = applyMove(game.board as Cell[], cfg, position, mark).outcome;
  } catch (e) {
    mapMoveError(e);
  }
  const now = new Date();
  const set: Record<string, unknown> = {
    [`board.${position}`]: mark,
    currentTurn: otherMark(mark),
    lastMoveAt: now,
    turnDeadline: game.turnTimeoutSec > 0 ? addMs(now, game.turnTimeoutSec * 1000) : null,
  };
  if (outcome.status !== 'IN_PROGRESS') {
    set.status = outcome.status === 'WIN' ? 'COMPLETED' : 'DRAW';
    set.endedAt = now;
    set.durationMs = game.startedAt ? now.getTime() - new Date(game.startedAt).getTime() : 0;
    set.turnDeadline = null;
    set.purgeAt = addMs(now, RETAIN_FINISHED_MS);
    if (outcome.status === 'WIN') {
      const winner = game.players.find((p) => p.mark === outcome.winner);
      set['result.winner'] = outcome.winner;
      set['result.winnerId'] = winner?.userId ?? null;
      set['result.line'] = outcome.line;
      set['result.reason'] = 'LINE';
    } else {
      set['result.winner'] = null;
      set['result.winnerId'] = null;
      set['result.line'] = [];
      set['result.reason'] = 'DRAW';
    }
  }
  const updated = (await GameModel.findOneAndUpdate(
    { _id: game._id, status: 'IN_PROGRESS', currentTurn: mark, moveCount: game.moveCount, [`board.${position}`]: '' },
    { $set: set, $inc: { moveCount: 1 } },
    { new: true },
  ).lean()) as G | null;
  if (!updated) throw new StaleGame();

  let move;
  try {
    move = await MoveModel.create({
      gameId: game._id,
      moveNumber: game.moveCount + 1,
      playerId,
      mark,
      position,
      clientMoveId,
      expireAt: addMs(now, RETAIN_FINISHED_MS),
    });
  } catch (err) {
    // The board is already authoritative; a failed log write must not roll back the accepted move.
    logger.error({ err: (err as Error).message, gameId: String(game._id) }, 'move log insert failed');
    move = null;
  }
  const lastMove = { moveNumber: game.moveCount + 1, position, mark, playerId: playerId ? String(playerId) : null };
  realtime.emitToGame(updated._id, 'game:updated', { game: presentGame(updated), lastMove });
  // After a finishing move the returned/acked game is the FINALIZED one (outcomes + points), same as game:finished.
  const finalGame = updated.status === 'COMPLETED' || updated.status === 'DRAW' ? await onGameEnded(updated) : updated;
  return { game: finalGame, move: move?.toJSON() ?? lastMove };
}

async function onGameEnded(g: G): Promise<G> {
  if (g.roomId) await RoomModel.updateOne({ _id: g.roomId, gameId: g._id }, { $set: { status: 'COMPLETED' } });
  try {
    await finalizeGame(String(g._id));
  } catch (err) {
    logger.error({ err: (err as Error).message, gameId: String(g._id) }, 'finalizeGame failed');
  }
  // Emit AFTER finalization so the payload carries every player's outcome and pointsAwarded (clients show the result from it).
  const fresh = ((await GameModel.findById(g._id).lean()) as G | null) ?? g;
  realtime.emitToGame(g._id, g.status === 'DRAW' ? 'game:draw' : 'game:finished', { game: presentGame(fresh) });
  return fresh;
}

export interface MoveInput {
  position: number;
  clientMoveId?: string;
  /** Optional optimistic check: the move number the client believes it is submitting. */
  expectedMoveNumber?: number;
}

export async function makeMove(userId: string, gameId: string, input: MoveInput) {
  const game = await loadMemberGame(userId, gameId);

  // Idempotency: the same clientMoveId always returns the originally accepted move.
  if (input.clientMoveId) {
    const dup = await MoveModel.findOne({ gameId: game._id, playerId: userId, clientMoveId: input.clientMoveId });
    if (dup) return { game: presentGame(game), move: dup.toJSON(), duplicate: true as const };
  }
  if (game.status !== 'IN_PROGRESS') throw Errors.conflict('This match isn\'t in progress.', 'GAME_NOT_ACTIVE');
  const mark = markOf(game, userId)!;
  if (game.currentTurn !== mark) throw Errors.conflict('It\'s not your turn.', 'NOT_YOUR_TURN');
  if (input.expectedMoveNumber !== undefined && input.expectedMoveNumber !== game.moveCount + 1) {
    throw Errors.conflict('Your board is out of date. Refresh and try again.', 'MOVE_CONFLICT', { moveCount: game.moveCount });
  }

  let result;
  try {
    result = await commitMove(game, mark, new Types.ObjectId(userId), input.position, input.clientMoveId);
  } catch (e) {
    if (e instanceof StaleGame) {
      // Lost a race. If it was a retry of the same submission, answer idempotently, otherwise report the conflict.
      if (input.clientMoveId) {
        const dup = await MoveModel.findOne({ gameId: game._id, playerId: userId, clientMoveId: input.clientMoveId });
        if (dup) return { game: presentGame(await loadGame(gameId)), move: dup.toJSON(), duplicate: true as const };
      }
      const latest = await loadGame(gameId);
      if (latest.status !== 'IN_PROGRESS') throw Errors.conflict('This match isn\'t in progress.', 'GAME_NOT_ACTIVE');
      if (latest.currentTurn !== mark) throw Errors.conflict('It\'s not your turn.', 'NOT_YOUR_TURN');
      throw Errors.conflict('Your board is out of date. Refresh and try again.', 'MOVE_CONFLICT', { moveCount: latest.moveCount });
    }
    throw e;
  }

  let finalGame = result.game;
  let aiMove: { position: number; moveNumber: number; mark: Mark } | undefined;
  if (finalGame.type === 'AI' && finalGame.status === 'IN_PROGRESS') {
    const ai = await playAiTurnDetailed(gameId);
    if (ai) {
      finalGame = ai.game;
      aiMove = { position: ai.position, moveNumber: ai.game.moveCount, mark: ai.mark };
    }
  }
  return { game: presentGame(finalGame), move: result.move, ...(aiMove ? { aiMove } : {}), duplicate: false as const };
}

/** Lets the server-side AI play if it is its turn. Returns the updated game (or null if nothing happened). */
export async function playAiTurn(gameId: string): Promise<G | null> {
  return (await playAiTurnDetailed(gameId))?.game ?? null;
}

async function playAiTurnDetailed(gameId: string): Promise<{ game: G; position: number; mark: Mark } | null> {
  const game = await loadGame(gameId);
  if (game.type !== 'AI' || game.status !== 'IN_PROGRESS') return null;
  const ai = game.players.find((p) => p.isAI);
  if (!ai || game.currentTurn !== ai.mark) return null;
  const cfg: BoardConfig = { size: game.boardSize as BoardSize, winLength: game.winLength };
  const position = chooseMove(game.board as Cell[], cfg, ai.mark as Mark, (game.difficulty ?? 'MEDIUM') as Difficulty);
  try {
    const { game: updated } = await commitMove(game, ai.mark as Mark, null, position);
    return { game: updated, position, mark: ai.mark as Mark };
  } catch (e) {
    if (e instanceof StaleGame) return null;
    throw e;
  }
}

// ------------------------------------------------------------------ forfeit / timeout / cancel

type EndReason = 'FORFEIT' | 'TIMEOUT' | 'DISCONNECT';

/** Ends an IN_PROGRESS game because `loserMark` gave up / timed out / left. Atomic and idempotent. */
export async function concludeGame(gameId: string | Types.ObjectId, loserMark: Mark, reason: EndReason): Promise<G | null> {
  const g = (await GameModel.findById(gameId).lean()) as G | null;
  if (!g || g.status !== 'IN_PROGRESS') return null;
  const winnerMark = otherMark(loserMark);
  const winner = g.players.find((p) => p.mark === winnerMark);
  const now = new Date();
  const updated = (await GameModel.findOneAndUpdate(
    { _id: g._id, status: 'IN_PROGRESS' },
    {
      $set: {
        status: 'COMPLETED',
        endedAt: now,
        durationMs: g.startedAt ? now.getTime() - new Date(g.startedAt).getTime() : 0,
        turnDeadline: null,
        purgeAt: addMs(now, RETAIN_FINISHED_MS),
        'result.winner': winnerMark,
        'result.winnerId': winner?.userId ?? null,
        'result.line': [],
        'result.reason': reason,
      },
    },
    { new: true },
  ).lean()) as G | null;
  if (!updated) return null;
  realtime.emitToGame(updated._id, 'game:updated', { game: presentGame(updated) });
  await onGameEnded(updated);
  return updated;
}

async function cancelUnstarted(g: G, status: 'CANCELLED' | 'EXPIRED'): Promise<G | null> {
  const updated = (await GameModel.findOneAndUpdate(
    { _id: g._id, status: { $in: ['WAITING', 'READY'] } },
    { $set: { status, endedAt: new Date(), turnDeadline: null, purgeAt: addMs(new Date(), RETAIN_CANCELLED_MS) } },
    { new: true },
  ).lean()) as G | null;
  if (!updated) return null;
  realtime.emitToGame(updated._id, 'game:updated', { game: presentGame(updated) });
  if (updated.roomId) {
    const room = await RoomModel.findOne({ _id: updated.roomId, gameId: updated._id });
    if (room) {
      room.gameId = null;
      room.status = room.guestId ? 'FULL' : 'WAITING';
      room.guestReady = false;
      await room.save();
      realtime.emitToRoom(room._id, 'room:updated', { room: room.toJSON() });
    }
  }
  return updated;
}

const INVITE_TTL_MS = 10 * 60_000;

/** Friend challenges still waiting for an answer: the ones sent to me, and the ones I sent. */
export async function listInvites(userId: string) {
  const [incomingGames, outgoingGames] = await Promise.all([
    GameModel.find({ type: 'FRIEND', status: 'WAITING', invitedUserId: userId, playerIds: { $ne: userId } }).sort({ createdAt: -1 }).limit(50).lean() as unknown as Promise<G[]>,
    GameModel.find({ type: 'FRIEND', status: 'WAITING', createdBy: userId }).sort({ createdAt: -1 }).limit(50).lean() as unknown as Promise<G[]>,
  ]);
  const ids = [...new Set([...incomingGames, ...outgoingGames].flatMap((g) => [String(g.createdBy), String(g.invitedUserId)]))];
  const users = await UserModel.find({ _id: { $in: ids } }).select(CARD_FIELDS).lean();
  const card = (id: unknown) => {
    const u = users.find((x) => String(x._id) === String(id));
    return u ? toCard(u) : null;
  };
  const present = (g: G) => ({
    game: presentGame(g),
    from: card(g.createdBy),
    to: card(g.invitedUserId),
    expiresAt: new Date(new Date(g.createdAt ?? Date.now()).getTime() + INVITE_TTL_MS).toISOString(),
  });
  return { incoming: incomingGames.map(present), outgoing: outgoingGames.map(present) };
}

/** The invitee turns a challenge down. Nothing was charged yet, so nothing needs returning. */
export async function declineInvite(userId: string, gameId: string) {
  const g = await loadGame(gameId);
  if (g.type !== 'FRIEND') throw Errors.badRequest('Not a friend challenge', 'NOT_AN_INVITE');
  if (String(g.invitedUserId) !== userId) throw Errors.forbidden('This challenge was not sent to you', 'NOT_INVITEE');
  const done = await cancelUnstarted(g, 'CANCELLED');
  if (!done) throw Errors.conflict('This challenge is no longer waiting.', 'INVITE_CLOSED');
  await notify(String(g.createdBy), { type: 'GAME_INVITE_DECLINED', title: 'Challenge declined', body: 'Your friend declined the challenge.', data: { gameId } });
  return { declined: true as const };
}

/** The inviter takes back a challenge that has not been accepted yet. */
export async function cancelInvite(userId: string, gameId: string) {
  const g = await loadGame(gameId);
  if (g.type !== 'FRIEND') throw Errors.badRequest('Not a friend challenge', 'NOT_AN_INVITE');
  if (String(g.createdBy) !== userId) throw Errors.forbidden('Only the sender can cancel this challenge', 'NOT_INVITER');
  const done = await cancelUnstarted(g, 'CANCELLED');
  if (!done) throw Errors.conflict('This challenge is no longer waiting.', 'INVITE_CLOSED');
  if (g.invitedUserId) {
    await notify(String(g.invitedUserId), { type: 'GAME_INVITE_CANCELLED', title: 'Challenge cancelled', body: 'The challenge was cancelled.', data: { gameId } });
  }
  return { cancelled: true as const };
}

async function notifyInviteExpired(g: G): Promise<void> {
  const data = { gameId: String(g._id) };
  await notify(String(g.createdBy), { type: 'GAME_INVITE_EXPIRED', title: 'Challenge expired', body: 'Nobody accepted the challenge in time.', data });
  if (g.invitedUserId) {
    await notify(String(g.invitedUserId), { type: 'GAME_INVITE_EXPIRED', title: 'Challenge expired', body: 'The challenge has expired.', data });
  }
}

/** Leave a game: forfeits a running game (opponent wins) or cancels one that has not started. */
export async function forfeit(userId: string, gameId: string) {
  const g = await loadMemberGame(userId, gameId);
  if (g.status === 'IN_PROGRESS') {
    const done = await concludeGame(g._id, markOf(g, userId)!, 'FORFEIT');
    return presentGame(done ?? (await loadGame(gameId)));
  }
  if (g.status === 'WAITING' || g.status === 'READY') {
    const done = await cancelUnstarted(g, 'CANCELLED');
    return presentGame(done ?? (await loadGame(gameId)));
  }
  throw Errors.conflict('This match has already ended.', 'GAME_NOT_ACTIVE');
}

// ------------------------------------------------------------------ mutual draw

const DRAW_OFFER_TTL_MS = 20_000;

/** Proposes a mutual draw to the opponent of an online game (valid for 20 s). One open offer per game. */
export async function offerDraw(userId: string, gameId: string) {
  const g = await loadMemberGame(userId, gameId);
  if (g.status !== 'IN_PROGRESS') throw Errors.conflict('This match isn\'t in progress.', 'GAME_NOT_ACTIVE');
  if (!ONLINE_TYPES.includes(g.type as (typeof ONLINE_TYPES)[number])) throw Errors.badRequest('You can only offer a draw in online matches.', 'NOT_SUPPORTED');
  const now = new Date();
  const expiresAt = addMs(now, DRAW_OFFER_TTL_MS);
  const updated = (await GameModel.findOneAndUpdate(
    { _id: g._id, status: 'IN_PROGRESS', $or: [{ 'drawOffer.by': null }, { 'drawOffer.expiresAt': { $lte: now } }, { 'drawOffer.expiresAt': null }] },
    { $set: { 'drawOffer.by': new Types.ObjectId(userId), 'drawOffer.expiresAt': expiresAt } },
    { new: true },
  ).lean()) as G | null;
  if (!updated) throw Errors.conflict('A draw offer is already open.', 'DRAW_OFFER_PENDING');
  realtime.emitToGame(g._id, 'game:draw-offered', { gameId, by: userId, expiresAt, moveCount: updated.moveCount });
  return presentGame(updated);
}

/** The opponent accepts (game ends as a DRAW) or declines the open offer. */
export async function respondDraw(userId: string, gameId: string, accept: boolean) {
  const g = await loadMemberGame(userId, gameId);
  const now = new Date();
  const offer = g.drawOffer;
  if (g.status !== 'IN_PROGRESS' || !offer?.by || !offer.expiresAt || new Date(offer.expiresAt) <= now) throw Errors.conflict('There is no open draw offer', 'NO_DRAW_OFFER');
  if (String(offer.by) === userId) throw Errors.badRequest('You cannot answer your own offer', 'OWN_DRAW_OFFER');
  if (!accept) {
    const cleared = (await GameModel.findOneAndUpdate({ _id: g._id, 'drawOffer.by': offer.by }, { $set: { 'drawOffer.by': null, 'drawOffer.expiresAt': null } }, { new: true }).lean()) as G | null;
    realtime.emitToGame(g._id, 'game:draw-declined', { gameId, by: userId });
    return presentGame(cleared ?? (await loadGame(gameId)));
  }
  const updated = (await GameModel.findOneAndUpdate(
    { _id: g._id, status: 'IN_PROGRESS', 'drawOffer.by': offer.by, 'drawOffer.expiresAt': { $gt: now } },
    {
      $set: {
        status: 'DRAW',
        endedAt: now,
        durationMs: g.startedAt ? now.getTime() - new Date(g.startedAt).getTime() : 0,
        turnDeadline: null,
        purgeAt: addMs(now, RETAIN_FINISHED_MS),
        'result.winner': null,
        'result.winnerId': null,
        'result.line': [],
        'result.reason': 'DRAW',
        'drawOffer.by': null,
        'drawOffer.expiresAt': null,
      },
    },
    { new: true },
  ).lean()) as G | null;
  if (!updated) throw Errors.conflict('There is no open draw offer', 'NO_DRAW_OFFER');
  return presentGame(await onGameEnded(updated));
}

// ------------------------------------------------------------------ rematch

export async function requestRematch(userId: string, gameId: string) {
  const g = await loadMemberGame(userId, gameId);
  if (g.status !== 'COMPLETED' && g.status !== 'DRAW') throw Errors.conflict('This match isn\'t finished yet.', 'GAME_NOT_FINISHED');
  if (g.type === 'LOCAL') throw Errors.badRequest('Offline matches can\'t have a rematch.', 'NOT_SUPPORTED');
  if (g.rematchGameId) return { status: 'STARTED' as const, game: presentGame(await loadGame(String(g.rematchGameId))) };

  const cfg: BoardConfig = { size: g.boardSize as BoardSize, winLength: g.winLength };

  if (g.type === 'AI') {
    const claim = await GameModel.findOneAndUpdate({ _id: g._id, rematchGameId: null }, { $set: { rematchGameId: new Types.ObjectId() } }, { new: true }).lean();
    if (!claim) return { status: 'STARTED' as const, game: presentGame(await loadGame(String((await loadGame(gameId)).rematchGameId))) };
    const myMark = markOf(g, userId)!;
    const created = await createAiGameWithId(claim.rematchGameId as Types.ObjectId, userId, cfg, otherMark(myMark), g.difficulty as Difficulty, g._id);
    return { status: 'STARTED' as const, game: presentGame(created) };
  }

  const opponent = g.players.find((p) => p.userId && String(p.userId) !== userId);
  if (!opponent?.userId) throw Errors.badRequest('There is no opponent to rematch.', 'NOT_SUPPORTED');
  await GameModel.updateOne({ _id: g._id }, { $addToSet: { rematchRequestedBy: new Types.ObjectId(userId) } });
  const fresh = await loadGame(gameId);
  const both = g.playerIds.every((id) => fresh.rematchRequestedBy.some((r) => String(r) === String(id)));

  if (!both) {
    realtime.emitToGame(g._id, 'game:rematch-requested', { gameId, requestedBy: userId });
    const me = await UserModel.findById(userId).select('displayName').lean();
    await notify(opponent.userId, { type: 'REMATCH_REQUEST', title: 'Rematch requested', body: `${me?.displayName ?? 'Your opponent'} wants a rematch`, data: { gameId } });
    return { status: 'REQUESTED' as const, game: presentGame(fresh) };
  }

  const newId = new Types.ObjectId();
  // A paid room match charges both players again for the rematch. The charge is keyed to the previous game, so repeated
  // requests cannot charge twice.
  const entry = g.entryAmount ?? 0;
  if (entry > 0) await chargeEntry(g.playerIds, entry, `rematch-${String(g._id)}`);
  const claim = await GameModel.findOneAndUpdate({ _id: g._id, rematchGameId: null }, { $set: { rematchGameId: newId } }, { new: true }).lean();
  if (!claim) {
    const latest = await loadGame(gameId);
    return { status: 'STARTED' as const, game: presentGame(await loadGame(String(latest.rematchGameId))) };
  }
  // Both players must be free to start another online game.
  const humans = g.players.filter((p) => p.userId).map((p) => ({ userId: p.userId as Types.ObjectId, mark: otherMark(p.mark as Mark) }));
  const created = await createGameDoc({
    _id: newId,
    type: g.type,
    config: cfg,
    humans,
    status: 'IN_PROGRESS',
    roomId: g.roomId ?? undefined,
    previousGameId: g._id,
    createdBy: g.createdBy ?? undefined,
    entryAmount: entry,
  });
  for (const h of humans) realtime.joinUserTo(h.userId, `game:${created._id}`);
  if (created.roomId) await RoomModel.updateOne({ _id: created.roomId }, { $set: { gameId: created._id, status: 'PLAYING' } });
  const payload = { previousGameId: gameId, game: presentGame(created) };
  realtime.emitToGame(g._id, 'game:rematch-accepted', payload);
  realtime.emitToGame(created._id, 'game:started', { game: presentGame(created), players: await playerCards(created) });
  return { status: 'STARTED' as const, game: presentGame(created) };
}

async function createAiGameWithId(id: Types.ObjectId, userId: string, config: BoardConfig, humanMark: Mark, difficulty: Difficulty, previousGameId: Types.ObjectId) {
  let game = await createGameDoc({ _id: id, type: 'AI', config, humans: [{ userId, mark: humanMark }], status: 'IN_PROGRESS', difficulty, previousGameId });
  if (humanMark === 'O') game = (await playAiTurn(String(game._id))) ?? game;
  realtime.joinUserTo(userId, `game:${game._id}`);
  return game;
}

// ------------------------------------------------------------------ reads

export async function getGame(userId: string, gameId: string) {
  return presentGame(await loadMemberGame(userId, gameId));
}

export async function getActiveGames(userId: string) {
  const games = (await GameModel.find({ playerIds: userId, status: { $in: ACTIVE_GAME_STATUSES } }).sort({ createdAt: -1 }).limit(10).lean()) as G[];
  return games.map(presentGame);
}

export async function getMoveHistory(userId: string, gameId: string) {
  const g = await loadMemberGame(userId, gameId);
  const moves = await MoveModel.find({ gameId: g._id }).sort({ moveNumber: 1 }).lean();
  return moves.map((m) => ({
    moveNumber: m.moveNumber,
    position: m.position,
    row: Math.floor(m.position / g.boardSize),
    col: m.position % g.boardSize,
    mark: m.mark,
    playerId: m.playerId ? String(m.playerId) : null,
    playedAt: (m as { createdAt?: Date }).createdAt,
  }));
}

/** Move-by-move replay: board snapshot after every move. */
export async function getReplay(userId: string, gameId: string) {
  const g = await loadMemberGame(userId, gameId);
  const history = await getMoveHistory(userId, gameId);
  const board: string[] = createBoard(g.boardSize);
  const frames = [{ moveNumber: 0, board: board.slice(), mark: null as Mark | null, position: null as number | null }];
  for (const m of history) {
    board[m.position] = m.mark;
    frames.push({ moveNumber: m.moveNumber, board: board.slice(), mark: m.mark as Mark, position: m.position });
  }
  return { game: presentGame(g), totalMoves: history.length, frames };
}

// ------------------------------------------------------------------ presence hooks & maintenance

/** Called by the socket layer when a user's last socket disconnects / first socket (re)connects. */
export async function markConnection(userId: string, connected: boolean): Promise<void> {
  const games = (await GameModel.find({ playerIds: userId, status: 'IN_PROGRESS' }).lean()) as G[];
  for (const g of games) {
    const mark = markOf(g, userId);
    if (!mark) continue;
    if (connected) {
      if (g.disconnectedAt?.[mark]) {
        await GameModel.updateOne({ _id: g._id }, { $set: { [`disconnectedAt.${mark}`]: null } });
        realtime.emitToGame(g._id, 'player:reconnected', { gameId: String(g._id), userId });
      }
    } else if (g.type !== 'AI') {
      await GameModel.updateOne({ _id: g._id, status: 'IN_PROGRESS' }, { $set: { [`disconnectedAt.${mark}`]: new Date() } });
      realtime.emitToGame(g._id, 'player:disconnected', {
        gameId: String(g._id),
        userId,
        graceSeconds: env.DISCONNECT_GRACE_SEC,
      });
    }
  }
}

/** On (re)connect: rejoin every active game room and return the latest state of each. */
export async function resumeGames(userId: string) {
  const games = (await GameModel.find({ playerIds: userId, status: { $in: ACTIVE_GAME_STATUSES } }).lean()) as G[];
  for (const g of games) realtime.joinUserTo(userId, `game:${g._id}`);
  return games.map(presentGame);
}

/** Periodic job: turn timeouts, disconnect forfeits, stale unstarted games. */
export async function processGameTimeouts(now = new Date()): Promise<{ timedOut: number; disconnected: number; expired: number }> {
  let timedOut = 0;
  let disconnected = 0;
  let expired = 0;

  const late = (await GameModel.find({ status: 'IN_PROGRESS', turnDeadline: { $lt: now } }).limit(200).lean()) as G[];
  for (const g of late) if (await concludeGame(g._id, g.currentTurn as Mark, 'TIMEOUT')) timedOut++;

  const cutoff = addMs(now, -env.DISCONNECT_GRACE_SEC * 1000);
  for (const mark of ['X', 'O'] as const) {
    const gone = (await GameModel.find({ status: 'IN_PROGRESS', [`disconnectedAt.${mark}`]: { $lt: cutoff } }).limit(200).lean()) as G[];
    for (const g of gone) if (await concludeGame(g._id, mark, 'DISCONNECT')) disconnected++;
  }

  const staleReady = (await GameModel.find({ status: 'READY', createdAt: { $lt: addMs(now, -60_000) } }).limit(200).lean()) as G[];
  for (const g of staleReady) if (await cancelUnstarted(g, 'CANCELLED')) expired++;
  const staleWaiting = (await GameModel.find({ status: 'WAITING', createdAt: { $lt: addMs(now, -10 * 60_000) } }).limit(200).lean()) as G[];
  for (const g of staleWaiting) {
    if (!(await cancelUnstarted(g, 'EXPIRED'))) continue;
    expired++;
    if (g.type === 'FRIEND') await notifyInviteExpired(g);
  }
  return { timedOut, disconnected, expired };
}

export { AppError };
