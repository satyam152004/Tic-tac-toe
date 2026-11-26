import { Types } from 'mongoose';
import { logger } from '../config/logger.js';
import { POINTS } from '../constants/index.js';
import { GameModel, LeaderboardEntryModel, UserModel } from '../models/index.js';
import { addMs, dayKey, DAY_MS, monthKey, weekKey } from '../utils/time.js';
import { evaluateAchievements } from './achievement.service.js';
import { settleMatch } from './coin.service.js';
import { notify } from './notification.service.js';
import { levelForXp } from './presenter.js';
import { realtime } from './realtime.js';

type Outcome = 'WIN' | 'LOSS' | 'DRAW';

interface FinishedGame {
  _id: Types.ObjectId;
  type: string;
  status: string;
  boardSize: number;
  winLength: number;
  moveCount: number;
  difficulty?: string | null;
  durationMs?: number | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  players: Array<{ userId?: Types.ObjectId | null; mark: string; isAI: boolean }>;
  result?: { winner?: string | null; winnerId?: Types.ObjectId | null; reason?: string | null } | null;
}

/** All point values come from here => calculated on the server only. */
export function computePoints(g: Pick<FinishedGame, 'type' | 'boardSize' | 'difficulty'>, outcome: Outcome): number {
  const mult = POINTS.SIZE_MULTIPLIER[g.boardSize] ?? 1;
  let base: number;
  if (g.type === 'AI') {
    const d = (g.difficulty ?? 'MEDIUM') as keyof typeof POINTS.AI_WIN;
    base = outcome === 'WIN' ? POINTS.AI_WIN[d] : outcome === 'DRAW' ? POINTS.AI_DRAW[d] : POINTS.AI_LOSS;
  } else {
    base = outcome === 'WIN' ? POINTS.ONLINE.WIN : outcome === 'DRAW' ? POINTS.ONLINE.DRAW : POINTS.ONLINE.LOSS;
    // Only anonymous random matchmaking is fully ranked; invited games are worth half (anti-collusion).
    if (g.type === 'FRIEND' || g.type === 'PRIVATE_ROOM') base = Math.round(base / 2);
  }
  return Math.round(base * mult);
}

const inc = (field: string, n: number) => ({ $add: [{ $ifNull: [`$stats.${field}`, 0] }, n] });

/**
 * Applies the result of a finished game to player statistics, points, XP, level, leaderboards and
 * achievements EXACTLY ONCE. The `finalizedAt: null -> Date` compare-and-set is the idempotency
 * guard: concurrent or repeated calls (retries, jobs, duplicate events) are no-ops.
 */
export async function finalizeGame(gameId: string): Promise<{ applied: boolean }> {
  // Pay out the entry pot first. The ledger keys make this safe to repeat, so a failed run can simply be retried.
  const pending = (await GameModel.findOne({ _id: gameId, status: { $in: ['COMPLETED', 'DRAW'] }, finalizedAt: null }).lean()) as unknown as
    | (Parameters<typeof settleMatch>[0])
    | null;
  if (pending) await settleMatch(pending);

  const g = (await GameModel.findOneAndUpdate(
    { _id: gameId, status: { $in: ['COMPLETED', 'DRAW'] }, finalizedAt: null },
    { $set: { finalizedAt: new Date() } },
    { new: true },
  ).lean()) as FinishedGame | null;
  if (!g) return { applied: false };
  if (g.type === 'LOCAL') return { applied: false };

  // Games abandoned before both sides moved never count (stops instant-forfeit point farming).
  const reason = g.result?.reason;
  if ((reason === 'FORFEIT' || reason === 'TIMEOUT' || reason === 'DISCONNECT') && g.moveCount < 2) return { applied: false };

  const now = new Date();
  const durationSec = Math.max(0, Math.round((g.durationMs ?? 0) / 1000));
  const winnerMoves = g.result?.winner === 'X' ? Math.ceil(g.moveCount / 2) : Math.floor(g.moveCount / 2);

  for (const p of g.players) {
    if (!p.userId || p.isAI) continue;
    const outcome: Outcome = g.status === 'DRAW' ? 'DRAW' : g.result?.winnerId && String(g.result.winnerId) === String(p.userId) ? 'WIN' : 'LOSS';
    const win = outcome === 'WIN';
    const loss = outcome === 'LOSS';
    const isAi = g.type === 'AI';
    const points = computePoints(g, outcome);
    const perfect = win && reason === 'LINE' && winnerMoves === g.winLength;
    const expertBeat = win && isAi && (g.difficulty === 'EXPERT' || g.difficulty === 'IMPOSSIBLE');

    const user = await UserModel.findOneAndUpdate(
      { _id: p.userId },
      [
        {
          $set: {
            'stats.totalGames': inc('totalGames', 1),
            'stats.wins': inc('wins', win ? 1 : 0),
            'stats.losses': inc('losses', loss ? 1 : 0),
            'stats.draws': inc('draws', outcome === 'DRAW' ? 1 : 0),
            'stats.points': inc('points', points),
            'stats.xp': inc('xp', points),
            'stats.totalPlayTimeSec': inc('totalPlayTimeSec', durationSec),
            'stats.aiGames': inc('aiGames', isAi ? 1 : 0),
            'stats.aiWins': inc('aiWins', isAi && win ? 1 : 0),
            'stats.onlineGames': inc('onlineGames', isAi ? 0 : 1),
            'stats.onlineWins': inc('onlineWins', !isAi && win ? 1 : 0),
            'stats.privateRoomWins': inc('privateRoomWins', g.type === 'PRIVATE_ROOM' && win ? 1 : 0),
            'stats.perfectGames': inc('perfectGames', perfect ? 1 : 0),
            'stats.expertAiWins': inc('expertAiWins', expertBeat ? 1 : 0),
            // A win extends the streak, a loss resets it, a draw leaves it untouched.
            'stats.currentStreak': win ? inc('currentStreak', 1) : loss ? 0 : { $ifNull: ['$stats.currentStreak', 0] },
            lastActiveAt: now,
          },
        },
        {
          $set: {
            'stats.bestStreak': { $max: [{ $ifNull: ['$stats.bestStreak', 0] }, '$stats.currentStreak'] },
            'stats.level': { $add: [1, { $floor: { $sqrt: { $divide: ['$stats.xp', 50] } } }] },
          },
        },
      ],
      { new: true },
    ).lean();
    if (!user) continue;

    await GameModel.updateOne({ _id: g._id, 'players.userId': p.userId }, { $set: { 'players.$.outcome': outcome, 'players.$.pointsAwarded': points } });

    // Per-period leaderboards (all-time boards read users.stats directly).
    const keys: Array<['daily' | 'weekly' | 'monthly', string, number]> = [
      ['daily', dayKey(now), 40 * DAY_MS],
      ['weekly', weekKey(now), 120 * DAY_MS],
      ['monthly', monthKey(now), 400 * DAY_MS],
    ];
    await Promise.all(
      keys.map(([period, periodKey, ttl]) =>
        LeaderboardEntryModel.updateOne(
          { period, periodKey, userId: p.userId },
          { $inc: { points, wins: win ? 1 : 0, games: 1 }, $setOnInsert: { expireAt: addMs(now, ttl) } },
          { upsert: true },
        ),
      ),
    );

    const oldLevel = levelForXp((user.stats?.xp ?? 0) - points);
    const newLevel = user.stats?.level ?? 1;
    if (newLevel > oldLevel) {
      realtime.emitToUser(p.userId, 'player:level-up', { level: newLevel });
      void notify(p.userId, { type: 'LEVEL_UP', title: 'Level up!', body: `You reached level ${newLevel}`, data: { level: String(newLevel) } });
    }

    await evaluateAchievements(String(p.userId)).catch((err: Error) => logger.error({ err: err.message }, 'achievement evaluation failed'));
  }
  return { applied: true };
}
