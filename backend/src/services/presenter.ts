import type { UserAttrs } from '../models/User.js';

type UserLike = Partial<UserAttrs> & { _id: unknown; stats?: Partial<UserAttrs['stats']> | null };

/** Level curve: level n requires 50*(n-1)^2 XP (L2=50, L3=200, L4=450 ...). */
export const levelForXp = (xp: number): number => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 50));
export const xpForLevel = (level: number): number => 50 * (level - 1) ** 2;

export function computeStats(s: UserLike['stats']) {
  const st = (s ?? {}) as Record<string, number | undefined>;
  const total = st.totalGames ?? 0;
  const wins = st.wins ?? 0;
  const xp = st.xp ?? 0;
  const level = st.level ?? 1;
  return {
    totalGames: total,
    wins,
    losses: st.losses ?? 0,
    draws: st.draws ?? 0,
    winPercentage: total ? Math.round((wins / total) * 1000) / 10 : 0,
    points: st.points ?? 0,
    xp,
    level,
    xpForNextLevel: xpForLevel(level + 1),
    xpForCurrentLevel: xpForLevel(level),
    currentStreak: st.currentStreak ?? 0,
    bestStreak: st.bestStreak ?? 0,
    totalPlayTimeSec: st.totalPlayTimeSec ?? 0,
    averageGameDurationSec: total ? Math.round(((st.totalPlayTimeSec ?? 0) / total) * 10) / 10 : 0,
    aiGames: st.aiGames ?? 0,
    aiWins: st.aiWins ?? 0,
    onlineGames: st.onlineGames ?? 0,
    onlineWins: st.onlineWins ?? 0,
    local: {
      games: st.localGames ?? 0,
      wins: st.localWins ?? 0,
      losses: st.localLosses ?? 0,
      draws: st.localDraws ?? 0,
    },
  };
}

/** Full profile for the owner (never includes password hash / tokens). */
export function toSelf(u: UserLike) {
  return {
    id: String(u._id),
    username: u.username,
    displayName: u.displayName,
    email: u.email ?? null,
    emailVerified: u.emailVerified ?? false,
    avatar: u.avatar,
    bio: u.bio ?? '',
    timezone: u.timezone ?? 'UTC',
    wallet: { coins: u.wallet?.coins ?? 0 },
    accountType: u.accountType,
    theme: u.theme,
    sound: u.sound,
    language: u.language,
    notificationPrefs: u.notificationPrefs,
    privacy: { allowSpectating: u.privacy?.allowSpectating ?? true },
    online: u.online ?? false,
    lastActiveAt: u.lastActiveAt,
    createdAt: (u as { createdAt?: Date }).createdAt,
    stats: computeStats(u.stats),
  };
}

/** Public profile (what other players see). No email, no preferences. */
export function toPublic(u: UserLike) {
  const s = computeStats(u.stats);
  return {
    id: String(u._id),
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar,
    bio: u.bio ?? '',
    accountType: u.accountType,
    online: u.online ?? false,
    lastActiveAt: u.lastActiveAt,
    createdAt: (u as { createdAt?: Date }).createdAt,
    stats: {
      totalGames: s.totalGames,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      winPercentage: s.winPercentage,
      points: s.points,
      level: s.level,
      bestStreak: s.bestStreak,
    },
  };
}

/** Minimal card used in lists, friends, leaderboards and game payloads. */
export function toCard(u: UserLike) {
  return {
    id: String(u._id),
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar,
    level: u.stats?.level ?? 1,
    online: u.online ?? false,
  };
}

export const CARD_FIELDS = 'username displayName avatar stats.level online lastActiveAt';
