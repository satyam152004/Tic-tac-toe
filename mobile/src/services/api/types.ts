/** Response types mirroring the backend JSON (source of truth: backend docs/API.md + src/services/presenter.ts). */
import type { BoardSize, Difficulty, Mark } from '../../game-engine';

export type { BoardSize, Difficulty, Mark };
export type ThemeId = 'dark' | 'light' | 'classic' | 'neon' | 'ocean' | 'sunset';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ({ page: number; limit: number; total: number; totalPages: number } & Record<string, unknown>) | Record<string, unknown>;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresAt: string;
}

export interface Stats {
  totalGames: number; wins: number; losses: number; draws: number; winPercentage: number;
  points: number; xp: number; level: number; xpForCurrentLevel: number; xpForNextLevel: number;
  currentStreak: number; bestStreak: number; totalPlayTimeSec: number; averageGameDurationSec: number;
  aiGames: number; aiWins: number; onlineGames: number; onlineWins: number;
  local: { games: number; wins: number; losses: number; draws: number };
}

export interface Me {
  id: string; username: string; displayName: string; email: string | null; emailVerified: boolean;
  avatar: string; bio: string; timezone: string; wallet: { coins: number };
  accountType: 'GUEST' | 'REGISTERED'; theme: ThemeId; language: string;
  sound: { effects: boolean; music: boolean; volume: number };
  notificationPrefs: { social: boolean; game: boolean; achievements: boolean; account: boolean };
  /** False for Google/Apple accounts until a password is added (Settings > Set a password). */
  hasPassword?: boolean;
  privacy?: { allowSpectating: boolean };
  online: boolean; lastActiveAt: string; createdAt: string; stats: Stats;
}

export interface PublicProfile {
  id: string; username: string; displayName: string; avatar: string; bio: string;
  accountType: 'GUEST' | 'REGISTERED'; online: boolean; lastActiveAt: string; createdAt: string;
  stats: Pick<Stats, 'totalGames' | 'wins' | 'losses' | 'draws' | 'winPercentage' | 'points' | 'level' | 'currentStreak' | 'bestStreak'> & Partial<Stats>;
}

export interface AuthResult { user: Me; tokens: Tokens }

export interface PlayerCard { id: string; username: string; displayName: string; avatar: string; level: number; online: boolean }

export type GameStatus = 'WAITING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'DRAW' | 'CANCELLED' | 'EXPIRED';
export type GameType = 'LOCAL' | 'AI' | 'ONLINE_RANDOM' | 'PRIVATE_ROOM' | 'FRIEND';

export interface Game {
  id: string;
  type: GameType;
  status: GameStatus;
  boardSize: BoardSize;
  winLength: number;
  board: Array<Mark | ''>;
  currentTurn: Mark;
  moveCount: number;
  players: Array<{ userId: string | null; mark: Mark; isAI: boolean; joined: boolean; outcome: 'WIN' | 'LOSS' | 'DRAW' | null; pointsAwarded: number }>;
  difficulty: Difficulty | null;
  roomId: string | null;
  turnTimeoutSec: number;
  turnDeadline: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  result: { winner: Mark | null; winnerId: string | null; line: number[]; reason: 'LINE' | 'DRAW' | 'FORFEIT' | 'TIMEOUT' | 'DISCONNECT' | null } | null;
  drawOffer?: { by: string; expiresAt: string } | null;
  rematch: { requestedBy: string[]; gameId: string | null };
  previousGameId: string | null;
  serverTime: string;
}

export interface MoveResult {
  game: Game;
  move: { moveNumber: number; position: number; mark: Mark };
  aiMove?: { position: number; moveNumber: number; mark: Mark };
  duplicate: boolean;
}

export interface Room {
  id: string; code: string; status: 'WAITING' | 'FULL' | 'READY' | 'PLAYING' | 'COMPLETED' | 'EXPIRED';
  host: PlayerCard | null; guest: PlayerCard | null; hostId: string; guestId: string | null;
  boardSize: BoardSize; winLength: number; guestReady: boolean; gameId: string | null; expiresAt: string; createdAt?: string;
}

export interface FriendItem {
  friendshipId: string;
  status: 'ACCEPTED' | 'PENDING';
  since: string | null;
  requestedAt: string;
  user: PlayerCard & { lastActiveAt?: string };
  /** Present for accepted friends: the live online game that may be watched, if any. */
  activeGameId?: string | null;
}

export type CheerKind = 'clap' | 'fire' | 'wow';
export interface SpectateSnapshot { game: Game; players: Array<{ mark: Mark; isAI: boolean; user: PlayerCard | null }>; spectators: number }

export interface LeaderboardRow {
  rank: number;
  user: PlayerCard;
  points: number;
  wins: number;
  games: number;
  isMe?: boolean;
}
export interface LeaderboardMe { rank: number | null; points: number; wins: number }

export interface AchievementItem {
  key: string; name: string; description: string; category: string; target: number;
  reward: { xp: number; points: number }; progress: number; unlocked: boolean; unlockedAt: string | null;
}
export interface MyAchievements { items: AchievementItem[]; unlockedCount: number; total: number; history: AchievementItem[] }

export interface HistoryItem {
  id: string; type: GameType; boardSize: BoardSize; winLength: number; difficulty: Difficulty | null;
  result: 'WIN' | 'LOSS' | 'DRAW' | null; myMark: Mark | null; pointsAwarded: number; endReason: string | null;
  moveCount: number; durationMs: number | null;
  opponent: (PlayerCard) | { isAI: true; difficulty: Difficulty | null } | null;
  playedAt: string;
}

export interface Streaks { currentStreak: number; bestStreak: number; recentForm: Array<'WIN' | 'LOSS' | 'DRAW'> }

export interface NotificationItem {
  id: string; type: string; category: string; title: string; body: string;
  data: Record<string, string>; readAt: string | null; createdAt: string;
}

export interface DailyRewardStatus {
  timezone: string; today: string; canClaim: boolean; claimedToday: boolean; nextDay: number; streak: number;
  nextClaimAt: string | null; coins: number;
  cycle: Array<{ day: number; coins: number; status: 'claimed' | 'claimable' | 'locked' }>;
}
export interface DailyClaimResult { claimed: { day: number; coins: number }; wallet: { coins: number }; status: DailyRewardStatus }

export interface ReplayFrame { moveNumber: number; position: number; mark: Mark; board: Array<Mark | ''> }
export interface Replay { game: Game; totalMoves: number; frames: ReplayFrame[] }

export interface MatchmakingStatus { queued: boolean; ticket: { id: string } | null; queuedForSec: number; activeGameId: string | null }

export interface Page<T> { items: T[]; page: number; limit: number; total: number; totalPages: number }

export type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; details?: unknown } };

/** Server -> client socket events (see backend docs/SOCKET_EVENTS.md). */
export interface ServerEvents {
  'session:ready': { userId: string; serverTime: string; activeGames: Game[] };
  'matchmaking:queued': { ticket: { id: string }; alreadyQueued: boolean };
  'matchmaking:found': { gameId: string; game: Game; opponent: PlayerCard | null };
  'matchmaking:cancelled': { reason: 'CANCELLED' | 'EXPIRED' };
  'game:started': { game: Game; players: Array<{ mark: Mark; isAI: boolean; user: PlayerCard | null }> };
  'game:updated': { game: Game; lastMove?: { moveNumber: number; position: number; mark: Mark; playerId: string | null }; resumed?: boolean };
  'game:move-rejected': { gameId?: string; clientMoveId?: string; position?: number; code: string; message: string };
  'game:finished': { game: Game };
  'game:draw': { game: Game };
  'game:draw-offered': { gameId: string; by: string; expiresAt: string; moveCount: number };
  'game:draw-declined': { gameId: string; by: string };
  'game:spectators': { gameId: string; count: number };
  'game:cheer': { gameId: string; kind: CheerKind; userId: string };
  'game:rematch-requested': { gameId: string; requestedBy: string };
  'game:rematch-accepted': { previousGameId: string; game: Game };
  'player:connected': { userId: string };
  'player:disconnected': { userId: string; gameId?: string; graceSeconds?: number };
  'player:reconnected': { gameId: string; userId: string };
  'player:level-up': { level: number };
  'player:achievement-unlocked': { key: string; name: string; reward: { xp: number; points: number } };
  'room:created': { room: Room };
  'room:updated': { room: Room };
  'room:expired': { roomId: string; reason: string };
  'notification:new': NotificationItem;
  'friends:updated': { blockedId: string };
  'server:shutdown': { reconnectInMs: number };
}
