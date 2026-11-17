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
import { BlockedUserModel, FriendshipModel, GameAttrs, GameModel, makePairKey, MoveModel, RoomModel, UserModel } from '../models/index.js';
import { AppError, Errors } from '../utils/errors.js';
import { CARD_FIELDS, toCard } from './presenter.js';
import { addMs, DAY_MS } from '../utils/time.js';
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
    turnTimeoutSec: g.turnTimeoutSec,
    turnDeadline: g.turnDeadline ?? null,
    startedAt: g.startedAt ?? null,
    endedAt: g.endedAt ?? null,
    durationMs: g.durationMs ?? null,
    result: g.result
      ? { winner: g.result.winner ?? null, winnerId: g.result.winnerId ? String(g.result.winnerId) : null, line: g.result.line ?? [], reason: g.result.reason ?? null }
      : null,
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
  const timeout = input.type === 'AI' ? 0 : env.TURN_TIMEOUT_SEC;
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
  if (g) throw Errors.conflict('You are already in an active game', 'ALREADY_IN_GAME', { gameId: String(g._id) });
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

export async function createFriendGame(userId: string, input: { opponentId: string; boardSize: number; winLength?: number }) {
  if (input.opponentId === userId) throw Errors.badRequest('You cannot invite yourself', 'SELF_INVITE');
  const config = resolveConfig(input.boardSize, input.winLength);
  const friends = await FriendshipModel.exists({ pairKey: makePairKey(userId, input.opponentId), status: 'ACCEPTED' });
  if (!friends) throw Errors.forbidden('You can only invite friends', 'NOT_FRIENDS');
  if (await areBlocked(userId, input.opponentId)) throw Errors.forbidden('Not allowed', 'BLOCKED');
  await assertNoActiveOnlineGame(userId);
  const me = await UserModel.findById(userId).select('displayName').lean();
  const game = await createGameDoc({
    type: 'FRIEND',
    config,
    humans: [{ userId, mark: randomMark() }],
    status: 'WAITING',
    invitedUserId: input.opponentId,
  });
  realtime.joinUserTo(userId, `game:${game._id}`);
  await notify(input.opponentId, {
    type: 'GAME_INVITE',
    title: 'Game invitation',
    body: `${me?.displayName ?? 'A friend'} invited you to play ${config.size}x${config.size}`,
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
    const updated = (await GameModel.findOneAndUpdate(
      { _id: g._id, status: 'WAITING', playerIds: { $ne: userId } },
      {
        $push: { players: { userId, mark: otherMark(creatorMark), isAI: false, joinedAt: new Date() }, playerIds: userId },
        $set: { status: 'READY' },
      },
      { new: true },
    ).lean()) as G | null;
    if (updated) {
      void notify(g.createdBy!, { type: 'OPPONENT_JOINED', title: 'Friend joined', body: 'Your friend accepted the game invitation', data: { gameId } });
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
    if (e.code === 'CELL_OCCUPIED') throw Errors.conflict('Cell is already occupied', 'CELL_OCCUPIED');
    if (e.code === 'CELL_OUT_OF_RANGE') throw Errors.badRequest('Cell is out of range', 'CELL_OUT_OF_RANGE');
    throw Errors.conflict('Game is not active', 'GAME_NOT_ACTIVE');
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
  if (game.status !== 'IN_PROGRESS') throw Errors.conflict('Game is not in progress', 'GAME_NOT_ACTIVE');
  const mark = markOf(game, userId)!;
  if (game.currentTurn !== mark) throw Errors.conflict('It is not your turn', 'NOT_YOUR_TURN');
  if (input.expectedMoveNumber !== undefined && input.expectedMoveNumber !== game.moveCount + 1) {
    throw Errors.conflict('Move number out of sync', 'MOVE_CONFLICT', { moveCount: game.moveCount });
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
      if (latest.status !== 'IN_PROGRESS') throw Errors.conflict('Game is not in progress', 'GAME_NOT_ACTIVE');
      if (latest.currentTurn !== mark) throw Errors.conflict('It is not your turn', 'NOT_YOUR_TURN');
      throw Errors.conflict('Move conflicts with a concurrent update', 'MOVE_CONFLICT', { moveCount: latest.moveCount });
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
  throw Errors.conflict('Game is already finished', 'GAME_NOT_ACTIVE');
}

// ------------------------------------------------------------------ rematch

export async function requestRematch(userId: string, gameId: string) {
  const g = await loadMemberGame(userId, gameId);
  if (g.status !== 'COMPLETED' && g.status !== 'DRAW') throw Errors.conflict('Game is not finished', 'GAME_NOT_FINISHED');
  if (g.type === 'LOCAL') throw Errors.badRequest('Local games have no rematch', 'NOT_SUPPORTED');
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
  if (!opponent?.userId) throw Errors.badRequest('No opponent for rematch', 'NOT_SUPPORTED');
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
  for (const g of staleWaiting) if (await cancelUnstarted(g, 'EXPIRED')) expired++;
  return { timedOut, disconnected, expired };
}

export { AppError };
