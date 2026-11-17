export const BOARD_SIZES = [3, 4, 5] as const;
export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EXPERT', 'IMPOSSIBLE'] as const;
export const GAME_TYPES = ['LOCAL', 'AI', 'ONLINE_RANDOM', 'PRIVATE_ROOM', 'FRIEND'] as const;
export const GAME_STATUSES = [
  'WAITING',
  'READY',
  'IN_PROGRESS',
  'COMPLETED',
  'DRAW',
  'CANCELLED',
  'EXPIRED',
] as const;
export const ACTIVE_GAME_STATUSES = ['WAITING', 'READY', 'IN_PROGRESS'] as const;
export const ROOM_STATUSES = ['WAITING', 'FULL', 'READY', 'PLAYING', 'COMPLETED', 'EXPIRED'] as const;
export const ACCOUNT_TYPES = ['GUEST', 'REGISTERED'] as const;
export const AUTH_PROVIDERS = ['password', 'google', 'apple', 'guest'] as const;
export const NOTIFICATION_TYPES = [
  'FRIEND_REQUEST',
  'FRIEND_ACCEPTED',
  'GAME_INVITE',
  'MATCH_FOUND',
  'OPPONENT_JOINED',
  'REMATCH_REQUEST',
  'ACHIEVEMENT_UNLOCKED',
  'LEVEL_UP',
  'ACCOUNT',
] as const;
export const NOTIFICATION_CATEGORIES = ['social', 'game', 'achievements', 'account'] as const;
export const LEADERBOARD_PERIODS = ['daily', 'weekly', 'monthly'] as const;
export const THEMES = ['light', 'dark', 'classic', 'neon', 'ocean', 'sunset'] as const;

/** Points awarded (calculated on the server only). */
export const POINTS = {
  ONLINE: { WIN: 25, DRAW: 10, LOSS: 3 },
  AI_WIN: { EASY: 3, MEDIUM: 8, HARD: 15, EXPERT: 22, IMPOSSIBLE: 35 },
  AI_DRAW: { EASY: 1, MEDIUM: 2, HARD: 5, EXPERT: 8, IMPOSSIBLE: 15 },
  AI_LOSS: 0,
  SIZE_MULTIPLIER: { 3: 1, 4: 1.5, 5: 2 } as Record<number, number>,
} as const;

/** Email one-time codes (verification + password reset). */
export const OTP = { LENGTH: 6, TTL_MS: 10 * 60 * 1000, MAX_ATTEMPTS: 5, RESEND_COOLDOWN_MS: 60 * 1000, MAX_SENDS_PER_HOUR: 5 } as const;

/** Daily reward cycle (coins per cycle day 1..7). Server-side only: clients can never choose an amount. */
export const DAILY_REWARD_COINS = [100, 150, 200, 250, 350, 450, 750] as const;
