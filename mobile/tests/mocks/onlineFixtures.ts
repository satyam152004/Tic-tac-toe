import type { Game, Me, PlayerCard } from '../../src/services/api/types';

export const ME_ID = 'user-me';
export const OPP_ID = 'user-opp';

export const meFixture = (over: Partial<Me> = {}): Me =>
  ({
    id: ME_ID, username: 'me', displayName: 'Me Player', email: null, emailVerified: false, avatar: 'av_1', bio: '', timezone: 'UTC',
    wallet: { coins: 0 }, accountType: 'REGISTERED', theme: 'dark', language: 'en',
    sound: { effects: true, music: true, volume: 1 }, notificationPrefs: { social: true, game: true, achievements: true, account: true },
    online: true, lastActiveAt: '', createdAt: '',
    stats: {
      totalGames: 3, wins: 2, losses: 1, draws: 0, winPercentage: 66, points: 1030, xp: 150, level: 2, xpForCurrentLevel: 100, xpForNextLevel: 300,
      currentStreak: 1, bestStreak: 2, totalPlayTimeSec: 0, averageGameDurationSec: 0, aiGames: 0, aiWins: 0, onlineGames: 3, onlineWins: 2,
      local: { games: 0, wins: 0, losses: 0, draws: 0 },
    },
    ...over,
  }) as Me;

export const oppCard: PlayerCard = { id: OPP_ID, username: 'opp', displayName: 'Opponent Pro', avatar: 'av_2', level: 5, online: true };

/** I am X (index 0 in players), opponent is O. */
export const gameFixture = (over: Partial<Game> = {}): Game => ({
  id: 'game-1',
  type: 'ONLINE_RANDOM',
  status: 'IN_PROGRESS',
  boardSize: 3,
  winLength: 3,
  board: ['', '', '', '', '', '', '', '', ''],
  currentTurn: 'X',
  moveCount: 0,
  players: [
    { userId: ME_ID, mark: 'X', isAI: false, joined: true, outcome: null, pointsAwarded: 0 },
    { userId: OPP_ID, mark: 'O', isAI: false, joined: true, outcome: null, pointsAwarded: 0 },
  ],
  difficulty: null,
  roomId: null,
  turnTimeoutSec: 30,
  turnDeadline: null,
  startedAt: null,
  endedAt: null,
  durationMs: null,
  result: null,
  rematch: { requestedBy: [], gameId: null },
  previousGameId: null,
  serverTime: '2026-01-01T00:00:00.000Z',
  ...over,
});
