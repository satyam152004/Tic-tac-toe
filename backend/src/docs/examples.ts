/**
 * Hand-written example `data` payloads for the most important endpoints (used by docs/API.md).
 * Endpoints without an entry fall back to the textual description of their response.
 */
const user = {
  id: '665f1c2e8b3a4c0012345678',
  username: 'player_one',
  displayName: 'Player One',
  email: 'player@example.com',
  emailVerified: false,
  avatar: 'avatar_default',
  accountType: 'REGISTERED',
  theme: 'light',
  sound: { effects: true, music: true, volume: 0.8 },
  language: 'en',
  notificationPrefs: { social: true, game: true, achievements: true, account: true },
  online: false,
  lastActiveAt: '2026-11-17T10:00:00.000Z',
  createdAt: '2026-11-17T10:00:00.000Z',
  stats: {
    totalGames: 12, wins: 7, losses: 3, draws: 2, winPercentage: 58.3, points: 215, xp: 215, level: 3,
    xpForCurrentLevel: 200, xpForNextLevel: 450, currentStreak: 2, bestStreak: 4, totalPlayTimeSec: 540,
    averageGameDurationSec: 45, aiGames: 5, aiWins: 4, onlineGames: 7, onlineWins: 3,
    local: { games: 3, wins: 2, losses: 1, draws: 0 },
  },
};
const tokens = { accessToken: 'eyJhbGciOiJIUzI1NiIs...', refreshToken: 'q8ZxV0...opaque-48-bytes...', tokenType: 'Bearer', expiresIn: 900, refreshExpiresAt: '2026-12-17T10:00:00.000Z' };
const game = {
  id: '665f1c2e8b3a4c0012349999', type: 'ONLINE_RANDOM', status: 'IN_PROGRESS', boardSize: 3, winLength: 3,
  board: ['X', '', '', '', 'O', '', '', '', ''], currentTurn: 'X', moveCount: 2,
  players: [
    { userId: '665f1c2e8b3a4c0012345678', mark: 'X', isAI: false, joined: true, outcome: null, pointsAwarded: 0 },
    { userId: '665f1c2e8b3a4c0012345679', mark: 'O', isAI: false, joined: true, outcome: null, pointsAwarded: 0 },
  ],
  difficulty: null, roomId: null, turnTimeoutSec: 60, turnDeadline: '2026-11-17T10:01:00.000Z',
  startedAt: '2026-11-17T10:00:00.000Z', endedAt: null, durationMs: null,
  result: { winner: null, winnerId: null, line: [], reason: null },
  rematch: { requestedBy: [], gameId: null }, previousGameId: null, createdAt: '2026-11-17T10:00:00.000Z', serverTime: '2026-11-17T10:00:20.000Z',
};
const room = {
  id: '665f1c2e8b3a4c0012340001', code: 'K7M3QX', status: 'WAITING',
  host: { id: '665f1c2e8b3a4c0012345678', username: 'player_one', displayName: 'Player One', avatar: 'avatar_default', level: 3, online: true },
  guest: null, hostId: '665f1c2e8b3a4c0012345678', guestId: null, boardSize: 3, winLength: 3, guestReady: false, isPublic: false, turnTimeoutSec: 60, gameId: null,
  expiresAt: '2026-11-17T10:30:00.000Z', createdAt: '2026-11-17T10:00:00.000Z',
};
const card = { id: '665f1c2e8b3a4c0012345679', username: 'friend_two', displayName: 'Friend Two', avatar: 'avatar_default', level: 2, online: true };

export const EXAMPLES: Record<string, unknown> = {
  'GET /health': { status: 'ok', db: 'up', uptimeSec: 3600, timestamp: '2026-11-17T10:00:00.000Z' },
  'GET /version': { name: 'tictactoe-backend', version: '1.0.0', apiVersion: 'v1', node: 'v22.0.0' },
  'POST /auth/register': { user, tokens },
  'POST /auth/login': { user, tokens },
  'POST /auth/guest': { user: { ...user, email: null, accountType: 'GUEST', username: 'guest_k3j9x2ab' }, tokens },
  'POST /auth/refresh': tokens,
  'POST /auth/logout': { loggedOut: true },
  'GET /users/me': user,
  'GET /users/:id': { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar, accountType: 'REGISTERED', online: false, stats: { totalGames: 12, wins: 7, losses: 3, draws: 2, winPercentage: 58.3, points: 215, level: 3, bestStreak: 4 } },
  'POST /games': { ...game, type: 'AI', difficulty: 'HARD', players: [{ userId: user.id, mark: 'X', isAI: false, joined: true, outcome: null, pointsAwarded: 0 }, { userId: null, mark: 'O', isAI: true, joined: true, outcome: null, pointsAwarded: 0 }] },
  'GET /games/:id': game,
  'POST /games/:id/moves': { game, move: { moveNumber: 3, position: 0, mark: 'X', playerId: user.id, gameId: game.id, clientMoveId: '3f2b9c1e-6a4d-4c77-9a53-0e1d8f2b7c11' }, duplicate: false },
  'POST /games/:id/rematch': { status: 'REQUESTED', game },
  'GET /games/:id/history': [{ moveNumber: 1, position: 4, row: 1, col: 1, mark: 'X', playerId: user.id, playedAt: '2026-11-17T10:00:05.000Z' }],
  'POST /matchmaking/join': { status: 'QUEUED', alreadyQueued: false, ticket: { id: '665f1c2e8b3a4c0012340abc', userId: user.id, boardSize: 3, winLength: 3, status: 'QUEUED', queueExpiresAt: '2026-11-17T10:02:00.000Z' } },
  'GET /matchmaking/status': { queued: true, ticket: { id: '665f1c2e8b3a4c0012340abc', status: 'QUEUED' }, queuedForSec: 8, activeGameId: null },
  'POST /rooms': room,
  'GET /rooms/open': { items: [{ id: room.id, code: room.code, host: room.host, hostPoints: 215, boardSize: 3, winLength: 3, turnTimeoutSec: 60, expiresAt: room.expiresAt, createdAt: room.createdAt }] },
  'POST /rooms/join': { ...room, status: 'FULL', guest: card, guestId: card.id },
  'POST /friends/request': { id: '665f1c2e8b3a4c0012340def', status: 'PENDING', recipientId: card.id },
  'GET /friends': [{ friendshipId: '665f1c2e8b3a4c0012340def', status: 'ACCEPTED', since: '2026-11-17T10:00:00.000Z', requestedAt: '2026-11-16T10:00:00.000Z', user: { ...card, lastActiveAt: '2026-11-17T10:00:00.000Z' } }],
  'GET /leaderboard/global': [{ rank: 1, user: card, points: 540, wins: 21, games: 30 }],
  'GET /statistics/me': user.stats,
  'GET /statistics/me/streaks': { currentStreak: 2, bestStreak: 4, recentForm: ['WIN', 'WIN', 'LOSS', 'DRAW'] },
  'POST /statistics/me/local-matches': { accepted: 2, duplicates: 0, rejected: [{ clientMatchId: 'local-0003', reason: 'Match is not finished' }] },
  'GET /achievements/me': { items: [{ key: 'FIRST_VICTORY', name: 'First Victory', description: 'Win your first game', category: 'wins', target: 1, reward: { xp: 25, points: 0 }, progress: 1, unlocked: true, unlockedAt: '2026-11-17T10:00:00.000Z' }], unlockedCount: 1, total: 12, history: [] },
  'GET /notifications': [{ id: '665f1c2e8b3a4c0012340fff', type: 'FRIEND_REQUEST', category: 'social', title: 'New friend request', body: 'Friend Two wants to be your friend', data: { friendshipId: '665f1c2e8b3a4c0012340def' }, readAt: null, createdAt: '2026-11-17T10:00:00.000Z' }],
  'POST /devices/register': { id: '665f1c2e8b3a4c0012340111', userId: user.id, platform: 'android', deviceName: 'Pixel 8', lastSeenAt: '2026-11-17T10:00:00.000Z' },
};
