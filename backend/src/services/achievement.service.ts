import { logger } from '../config/logger.js';
import { AchievementModel, UserAchievementModel, UserModel } from '../models/index.js';
import { notify } from './notification.service.js';
import { levelForXp } from './presenter.js';
import { realtime } from './realtime.js';

type Metric = 'wins' | 'onlineWins' | 'aiWins' | 'expertAiWins' | 'bestStreak' | 'perfectGames' | 'privateRoomWins' | 'totalGames';

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  category: 'wins' | 'streak' | 'online' | 'ai' | 'skill' | 'social' | 'general';
  metric: Metric;
  target: number;
  reward: { xp: number; points: number };
  sortOrder: number;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  { key: 'FIRST_VICTORY', name: 'First Victory', description: 'Win your first game', category: 'wins', metric: 'wins', target: 1, reward: { xp: 25, points: 0 }, sortOrder: 1 },
  { key: 'WINS_10', name: '10 Wins', description: 'Win 10 games', category: 'wins', metric: 'wins', target: 10, reward: { xp: 50, points: 0 }, sortOrder: 2 },
  { key: 'WINS_50', name: '50 Wins', description: 'Win 50 games', category: 'wins', metric: 'wins', target: 50, reward: { xp: 150, points: 0 }, sortOrder: 3 },
  { key: 'WINS_100', name: '100 Wins', description: 'Win 100 games', category: 'wins', metric: 'wins', target: 100, reward: { xp: 400, points: 0 }, sortOrder: 4 },
  { key: 'STREAK_3', name: 'Hat Trick', description: 'Win 3 games in a row', category: 'streak', metric: 'bestStreak', target: 3, reward: { xp: 40, points: 0 }, sortOrder: 5 },
  { key: 'STREAK_5', name: 'Winning Streak', description: 'Win 5 games in a row', category: 'streak', metric: 'bestStreak', target: 5, reward: { xp: 100, points: 0 }, sortOrder: 6 },
  { key: 'STREAK_10', name: 'Unstoppable', description: 'Win 10 games in a row', category: 'streak', metric: 'bestStreak', target: 10, reward: { xp: 300, points: 0 }, sortOrder: 7 },
  { key: 'MULTIPLAYER_CHAMPION', name: 'Multiplayer Champion', description: 'Win 25 online multiplayer games', category: 'online', metric: 'onlineWins', target: 25, reward: { xp: 200, points: 0 }, sortOrder: 8 },
  { key: 'AI_MASTER', name: 'AI Master', description: 'Beat the Expert or Impossible AI 5 times', category: 'ai', metric: 'expertAiWins', target: 5, reward: { xp: 250, points: 0 }, sortOrder: 9 },
  { key: 'PERFECT_GAME', name: 'Perfect Game', description: 'Win using the minimum possible number of moves', category: 'skill', metric: 'perfectGames', target: 1, reward: { xp: 60, points: 0 }, sortOrder: 10 },
  { key: 'TOURNAMENT_WINNER', name: 'Tournament Winner', description: 'Win 5 private-room matches (room tournaments)', category: 'social', metric: 'privateRoomWins', target: 5, reward: { xp: 150, points: 0 }, sortOrder: 11 },
  { key: 'PLAY_100', name: 'Dedicated Player', description: 'Play 100 games', category: 'general', metric: 'totalGames', target: 100, reward: { xp: 120, points: 0 }, sortOrder: 12 },
];

/** Idempotently writes the catalogue to MongoDB (called on startup). */
export async function seedAchievements(): Promise<void> {
  await Promise.all(
    ACHIEVEMENT_DEFINITIONS.map((d) =>
      AchievementModel.updateOne({ key: d.key }, { $set: { ...d } }, { upsert: true }),
    ),
  );
}

function metricsOf(stats: Record<string, number> | null | undefined): Record<Metric, number> {
  const s = stats ?? {};
  return {
    wins: s.wins ?? 0,
    onlineWins: s.onlineWins ?? 0,
    aiWins: s.aiWins ?? 0,
    expertAiWins: s.expertAiWins ?? 0,
    bestStreak: s.bestStreak ?? 0,
    perfectGames: s.perfectGames ?? 0,
    privateRoomWins: s.privateRoomWins ?? 0,
    totalGames: s.totalGames ?? 0,
  };
}

/** Evaluates unlock conditions from server-side statistics, unlocks once (atomically) and grants rewards. */
export async function evaluateAchievements(userId: string): Promise<string[]> {
  const user = await UserModel.findById(userId).select('stats').lean();
  if (!user) return [];
  const metrics = metricsOf(user.stats as unknown as Record<string, number>);
  const unlocked: string[] = [];

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    const value = metrics[def.metric];
    const progress = Math.min(value, def.target);
    await UserAchievementModel.updateOne(
      { userId, achievementKey: def.key },
      { $max: { progress }, $setOnInsert: { unlockedAt: null } },
      { upsert: true },
    );
    if (value < def.target) continue;
    // Compare-and-set: only the first evaluation that sees the condition unlocks (and rewards).
    const claimed = await UserAchievementModel.findOneAndUpdate(
      { userId, achievementKey: def.key, unlockedAt: null },
      { $set: { unlockedAt: new Date(), progress: def.target } },
    );
    if (!claimed) continue;
    unlocked.push(def.key);
    await grantReward(userId, def);
  }
  return unlocked;
}

async function grantReward(userId: string, def: AchievementDef): Promise<void> {
  const { xp, points } = def.reward;
  if (xp > 0 || points > 0) {
    const u = await UserModel.findOneAndUpdate(
      { _id: userId },
      [
        { $set: { 'stats.xp': { $add: [{ $ifNull: ['$stats.xp', 0] }, xp] }, 'stats.points': { $add: [{ $ifNull: ['$stats.points', 0] }, points] } } },
        { $set: { 'stats.level': { $add: [1, { $floor: { $sqrt: { $divide: ['$stats.xp', 50] } } }] } } },
      ],
      { new: true },
    ).lean();
    const newLevel = u?.stats?.level ?? 1;
    if (u && newLevel > levelForXp((u.stats?.xp ?? 0) - xp)) {
      void notify(userId, { type: 'LEVEL_UP', title: 'Level up!', body: `You reached level ${newLevel}`, data: { level: String(newLevel) } });
    }
  }
  realtime.emitToUser(userId, 'player:achievement-unlocked', { key: def.key, name: def.name, reward: def.reward });
  logger.info({ userId, achievement: def.key }, 'achievement unlocked');
  await notify(userId, {
    type: 'ACHIEVEMENT_UNLOCKED',
    title: 'Achievement unlocked',
    body: `${def.name}: ${def.description} (+${def.reward.xp} XP)`,
    data: { achievementKey: def.key },
  });
}

export async function listAchievements() {
  const rows = await AchievementModel.find().sort({ sortOrder: 1 }).lean();
  return rows.map((a) => ({ key: a.key, name: a.name, description: a.description, category: a.category, target: a.target, reward: a.reward }));
}

export async function myAchievements(userId: string) {
  const [defs, mine, user] = await Promise.all([
    AchievementModel.find().sort({ sortOrder: 1 }).lean(),
    UserAchievementModel.find({ userId }).lean(),
    UserModel.findById(userId).select('stats').lean(),
  ]);
  const metrics = metricsOf(user?.stats as unknown as Record<string, number>);
  const byKey = new Map(mine.map((m) => [m.achievementKey, m]));
  const items = defs.map((d) => {
    const m = byKey.get(d.key);
    const live = Math.min(metrics[d.metric as Metric] ?? 0, d.target);
    return {
      key: d.key,
      name: d.name,
      description: d.description,
      category: d.category,
      target: d.target,
      reward: d.reward,
      progress: Math.max(live, m?.progress ?? 0),
      unlocked: Boolean(m?.unlockedAt),
      unlockedAt: m?.unlockedAt ?? null,
    };
  });
  const history = items.filter((i) => i.unlocked).sort((a, b) => +new Date(b.unlockedAt!) - +new Date(a.unlockedAt!));
  return { items, unlockedCount: history.length, total: items.length, history };
}
