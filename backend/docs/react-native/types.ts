/** API response types shared with the backend (mirror of the JSON the server returns). */
import type { BoardSize, Difficulty, Mark } from './game-engine'; // copy of backend src/game-engine

export type { BoardSize, Difficulty, Mark };

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number } & Record<string, unknown>;
}
export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number; // seconds
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
  avatar: string; accountType: 'GUEST' | 'REGISTERED'; theme: string; language: string;
  sound: { effects: boolean; music: boolean; volume: number };
  notificationPrefs: { social: boolean; game: boolean; achievements: boolean; account: boolean };
  online: boolean; lastActiveAt: string; createdAt: string; stats: Stats;
}
export interface AuthResult { user: Me; tokens: Tokens }

export interface PlayerCard { id: string; username: string; displayName: string; avatar: string; level: number; online: boolean }

export type GameStatus = 'WAITING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'DRAW' | 'CANCELLED' | 'EXPIRED';
export interface Game {
  id: string;
  type: 'LOCAL' | 'AI' | 'ONLINE_RANDOM' | 'PRIVATE_ROOM' | 'FRIEND';
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
  rematch: { requestedBy: string[]; gameId: string | null };
  previousGameId: string | null;
  serverTime: string;
}

export interface MoveResult { game: Game; move: { moveNumber: number; position: number; mark: Mark }; aiMove?: { position: number; moveNumber: number; mark: Mark }; duplicate: boolean }
export interface Room {
  id: string; code: string; status: 'WAITING' | 'FULL' | 'READY' | 'PLAYING' | 'COMPLETED' | 'EXPIRED';
  host: PlayerCard | null; guest: PlayerCard | null; hostId: string; guestId: string | null;
  boardSize: BoardSize; winLength: number; guestReady: boolean; gameId: string | null; expiresAt: string;
}
export interface NotificationItem { id: string; type: string; category: string; title: string; body: string; data: Record<string, string>; readAt: string | null; createdAt: string }

/** Socket ack envelope. */
export type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; details?: unknown } };

/** Server -> client socket events (see docs/SOCKET_EVENTS.md). */
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
  'game:rematch-requested': { gameId: string; requestedBy: string };
  'game:rematch-accepted': { previousGameId: string; game: Game };
  'player:connected': { userId: string };
  'player:disconnected': { userId: string; gameId?: string; graceSeconds?: number };
  'player:reconnected': { gameId: string; userId: string };
  'room:created': { room: Room };
  'room:updated': { room: Room };
  'room:expired': { roomId: string; reason: string };
  'notification:new': NotificationItem;
  'server:shutdown': { reconnectInMs: number };
}
