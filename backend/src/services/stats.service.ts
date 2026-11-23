import { Types } from 'mongoose';
import { GameModel, MoveModel, UserModel } from '../models/index.js';
import { replayMoves, MoveError } from '../game-engine/index.js';
import { Errors } from '../utils/errors.js';
import { paged, skipOf } from '../utils/pagination.js';
import { CARD_FIELDS, computeStats, toCard } from './presenter.js';
import { createBoard } from '../game-engine/index.js';

const HISTORY_STATUSES = ['COMPLETED', 'DRAW'];

export async function myStats(userId: string) {
  const u = await UserModel.findById(userId).select('stats').lean();
  if (!u) throw Errors.notFound('Player not found');
  return computeStats(u.stats);
}

export interface HistoryQuery {
  page: number;
  limit: number;
  type?: string;
  result?: 'WIN' | 'LOSS' | 'DRAW';
}

export async function myHistory(userId: string, q: HistoryQuery) {
  const uid = new Types.ObjectId(userId);
  const filter: Record<string, unknown> = { playerIds: uid, status: { $in: HISTORY_STATUSES } };
  if (q.type) filter.type = q.type;
  if (q.result) filter.players = { $elemMatch: { userId: uid, outcome: q.result } };
  const [games, total] = await Promise.all([
    GameModel.find(filter).sort({ endedAt: -1, _id: -1 }).skip(skipOf(q)).limit(q.limit).lean(),
    GameModel.countDocuments(filter),
  ]);
  const oppIds = games.flatMap((g) => g.players.filter((p) => p.userId && String(p.userId) !== userId).map((p) => p.userId!));
  const opps = await UserModel.find({ _id: { $in: oppIds } }).select(CARD_FIELDS).lean();
  const byId = new Map(opps.map((o) => [String(o._id), toCard(o)]));
  const items = games.map((g) => {
    const me = g.players.find((p) => p.userId && String(p.userId) === userId);
    const opp = g.players.find((p) => !(p.userId && String(p.userId) === userId));
    return {
      id: String(g._id),
      type: g.type,
      boardSize: g.boardSize,
      winLength: g.winLength,
      difficulty: g.difficulty ?? null,
      result: me?.outcome ?? (g.status === 'DRAW' ? 'DRAW' : null),
      myMark: me?.mark ?? null,
      pointsAwarded: me?.pointsAwarded ?? 0,
      endReason: g.result?.reason ?? null,
      moveCount: g.moveCount,
      // Offline matches: lets the app open the copy it still has on the phone.
      clientMatchId: g.type === 'LOCAL' ? (g.clientMatchId ?? null) : null,
      durationMs: g.durationMs ?? null,
      opponent: opp ? (opp.isAI ? { isAI: true, difficulty: g.difficulty ?? null } : opp.userId ? (byId.get(String(opp.userId)) ?? null) : null) : null,
      playedAt: g.endedAt ?? (g as { createdAt?: Date }).createdAt,
    };
  });
  return paged(items, total, q);
}

export async function myStreaks(userId: string) {
  const u = await UserModel.findById(userId).select('stats.currentStreak stats.bestStreak').lean();
  if (!u) throw Errors.notFound('Player not found');
  const recent = await GameModel.find({ playerIds: userId, status: { $in: HISTORY_STATUSES }, type: { $ne: 'LOCAL' } })
    .sort({ endedAt: -1 })
    .limit(10)
    .select('players endedAt')
    .lean();
  const form = recent.map((g) => g.players.find((p) => p.userId && String(p.userId) === userId)?.outcome ?? null);
  return { currentStreak: u.stats?.currentStreak ?? 0, bestStreak: u.stats?.bestStreak ?? 0, recentForm: form };
}

export interface LocalMatchUpload {
  clientMatchId: string;
  size: 3 | 4 | 5;
  winLength: number;
  mode: 'LOCAL_2P' | 'VS_AI';
  difficulty?: string;
  humanMark?: 'X' | 'O';
  moves: number[];
  durationMs: number;
  playedAt?: string;
}

/**
 * Syncs offline matches into server history/statistics. Each match is VERIFIED by replaying its moves
 * through the shared engine (the client's claimed result is ignored). Idempotent per clientMatchId.
 * Local results only touch the separate `local*` counters: they never award points/XP/leaderboards.
 */
/**
 * Stores the move list of an uploaded offline match so it can be replayed from the history list.
 * X always moves first; in VS_AI only the human's moves carry the user id (the AI's are null, like online AI games).
 */
async function saveLocalMoves(gameId: Types.ObjectId, userId: string, m: LocalMatchUpload, humanMark: string, expireAt: Date): Promise<void> {
  const docs = m.moves.map((position, i) => {
    const mark = i % 2 === 0 ? 'X' : 'O';
    return { gameId, moveNumber: i + 1, playerId: m.mode === 'VS_AI' && mark !== humanMark ? null : new Types.ObjectId(userId), mark, position, expireAt };
  });
  if (!docs.length) return;
  try {
    await MoveModel.insertMany(docs, { ordered: true });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err; // already stored by a concurrent upload
  }
}

export async function syncLocalMatches(userId: string, matches: LocalMatchUpload[]) {
  let accepted = 0;
  let duplicates = 0;
  const rejected: Array<{ clientMatchId: string; reason: string }> = [];

  for (const m of matches) {
    let replay;
    try {
      replay = replayMoves({ size: m.size, winLength: m.winLength }, m.moves.map((position) => ({ position })));
    } catch (e) {
      rejected.push({ clientMatchId: m.clientMatchId, reason: e instanceof MoveError ? `Invalid move list (${e.code})` : 'Invalid configuration' });
      continue;
    }
    if (replay.outcome.status === 'IN_PROGRESS') {
      rejected.push({ clientMatchId: m.clientMatchId, reason: 'Match is not finished' });
      continue;
    }
    const humanMark = m.humanMark ?? 'X';
    const now = new Date();
    const winner = replay.outcome.status === 'WIN' ? replay.outcome.winner : null;
    const outcome = replay.outcome.status === 'DRAW' ? 'DRAW' : m.mode === 'VS_AI' ? (winner === humanMark ? 'WIN' : 'LOSS') : null;
    try {
      const purgeAt = new Date(now.getTime() + 365 * 24 * 3600_000);
      const game = await GameModel.create({
        type: 'LOCAL',
        status: replay.outcome.status === 'DRAW' ? 'DRAW' : 'COMPLETED',
        boardSize: m.size,
        winLength: m.winLength,
        board: replay.board.length ? replay.board : createBoard(m.size),
        currentTurn: 'X',
        moveCount: m.moves.length,
        players: [{ userId: userId, mark: humanMark, isAI: false, joinedAt: now, outcome }],
        playerIds: [userId],
        difficulty: m.mode === 'VS_AI' ? m.difficulty : undefined,
        createdBy: userId,
        clientMatchId: m.clientMatchId,
        startedAt: new Date(now.getTime() - Math.min(m.durationMs, 24 * 3600_000)),
        endedAt: now,
        durationMs: Math.min(Math.max(m.durationMs, 0), 24 * 3600_000),
        result: {
          winner,
          winnerId: winner === humanMark ? userId : null,
          line: replay.outcome.status === 'WIN' ? replay.outcome.line : [],
          reason: replay.outcome.status === 'DRAW' ? 'DRAW' : 'LINE',
        },
        finalizedAt: now,
        purgeAt,
      });
      await saveLocalMoves(game._id, userId, m, humanMark, purgeAt);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        duplicates++;
        // Matches uploaded before moves were stored have no move records: fill them in so their replay works.
        const existing = await GameModel.findOne({ createdBy: userId, clientMatchId: m.clientMatchId, type: 'LOCAL' }).select('_id purgeAt').lean();
        if (existing && !(await MoveModel.exists({ gameId: existing._id }))) {
          await saveLocalMoves(existing._id as Types.ObjectId, userId, m, humanMark, (existing.purgeAt as Date | undefined) ?? new Date(Date.now() + 365 * 24 * 3600_000));
        }
        continue;
      }
      throw err;
    }
    await UserModel.updateOne(
      { _id: userId },
      {
        $inc: {
          'stats.localGames': 1,
          'stats.localWins': outcome === 'WIN' ? 1 : 0,
          'stats.localLosses': outcome === 'LOSS' ? 1 : 0,
          'stats.localDraws': outcome === 'DRAW' ? 1 : 0,
        },
      },
    );
    accepted++;
  }
  return { accepted, duplicates, rejected };
}
