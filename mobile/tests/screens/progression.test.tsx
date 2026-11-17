import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ApiError } from '../../src/services/api/errors';

jest.mock('lucide-react-native', () => new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : () => null) }));

const mockNav = { nav: { navigate: jest.fn() }, goTab: jest.fn(), goHome: jest.fn(), resetTo: jest.fn(), back: jest.fn() };
jest.mock('../../src/navigation/useAppNav', () => ({ useAppNav: () => mockNav }));
jest.mock('../../src/services/api/statisticsApi', () => ({ statisticsApi: { me: jest.fn(), streaks: jest.fn(), history: jest.fn() } }));
jest.mock('../../src/services/api/gameApi', () => ({ gameApi: { replay: jest.fn() } }));
jest.mock('../../src/services/api/achievementApi', () => ({ achievementApi: { mine: jest.fn() } }));
jest.mock('../../src/services/api/rewardApi', () => ({ rewardApi: { status: jest.fn(), claim: jest.fn() } }));
jest.mock('../../src/services/api/userApi', () => ({ userApi: { me: jest.fn(), update: jest.fn() } }));

import { statisticsApi } from '../../src/services/api/statisticsApi';
import { gameApi } from '../../src/services/api/gameApi';
import { achievementApi } from '../../src/services/api/achievementApi';
import { rewardApi } from '../../src/services/api/rewardApi';
import { useAuthStore } from '../../src/store/authStore';
import { useToastStore } from '../../src/store/toastStore';
import { GameStatisticsScreen } from '../../src/screens/progression/GameStatisticsScreen';
import { AchievementsScreen } from '../../src/screens/progression/AchievementsScreen';
import { DailyRewardsScreen } from '../../src/screens/progression/DailyRewardsScreen';

const m = (f: unknown) => f as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const props: any = { navigation: {}, route: { key: 'k', name: 'x' } };

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

const STATS = {
  totalGames: 42, wins: 25, losses: 10, draws: 7, winPercentage: 59.5, points: 1337, xp: 880, level: 7,
  xpForCurrentLevel: 700, xpForNextLevel: 1000, currentStreak: 3, bestStreak: 9, totalPlayTimeSec: 7500, averageGameDurationSec: 75,
  aiGames: 20, aiWins: 12, onlineGames: 15, onlineWins: 9, local: { games: 7, wins: 4, losses: 2, draws: 1 },
};
const page = (items: unknown[]) => ({ items, page: 1, limit: 30, total: items.length, totalPages: 1, meta: {} });
const HIST = [
  { id: 'g1', type: 'AI', boardSize: 3, winLength: 3, difficulty: 'HARD', result: 'WIN', myMark: 'X', pointsAwarded: 15, endReason: 'LINE', moveCount: 5, durationMs: 65000, opponent: { isAI: true, difficulty: 'HARD' }, playedAt: '2026-11-10T10:00:00Z' },
  { id: 'g2', type: 'ONLINE_RANDOM', boardSize: 4, winLength: 4, difficulty: null, result: 'LOSS', myMark: 'O', pointsAwarded: -8, endReason: 'LINE', moveCount: 9, durationMs: 120000, opponent: { id: 'u2', username: 'bob', displayName: 'Bobby', avatar: 'av_2', level: 3, online: false }, playedAt: '2026-11-09T10:00:00Z' },
];

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ status: 'signedIn', user: null });
  useToastStore.setState({ toasts: [] } as never);
});

describe('GameStatisticsScreen', () => {
  beforeEach(() => {
    m(statisticsApi.me).mockResolvedValue(STATS);
    m(statisticsApi.streaks).mockResolvedValue({ currentStreak: 3, bestStreak: 9, recentForm: ['WIN', 'LOSS', 'DRAW'] });
    m(statisticsApi.history).mockResolvedValue(page(HIST));
  });

  it('renders real stats, recent form and history items', async () => {
    await wrap(<GameStatisticsScreen {...props} />);
    expect(await screen.findByLabelText('Total Games: 42')).toBeTruthy();
    expect(screen.getByLabelText('Win Percentage: 60%')).toBeTruthy();
    expect(screen.getByLabelText('Wins: 25')).toBeTruthy();
    expect(screen.getByLabelText('Losses / Draws: 10 / 7')).toBeTruthy();
    expect(screen.getByLabelText('Points: 1337')).toBeTruthy();
    expect(screen.getByLabelText('Play Time: 2h 05m')).toBeTruthy();
    expect(screen.getByText('20 games · 12 wins')).toBeTruthy();
    expect(await screen.findByTestId('recent-form')).toBeTruthy();
    expect(await screen.findByText('AI · Hard')).toBeTruthy();
    expect(screen.getByText('Bobby')).toBeTruthy();
    expect(screen.getByText('+15 pts')).toBeTruthy();
  });

  it('history filters call the API with the right params', async () => {
    await wrap(<GameStatisticsScreen {...props} />);
    await screen.findByText('AI · Hard');
    expect(statisticsApi.history).toHaveBeenLastCalledWith({});
    await fireEvent.press(screen.getByTestId('filter-type-ai'));
    await waitFor(() => expect(statisticsApi.history).toHaveBeenLastCalledWith({ type: 'AI' }));
    await fireEvent.press(screen.getByTestId('filter-result-win'));
    await waitFor(() => expect(statisticsApi.history).toHaveBeenLastCalledWith({ type: 'AI', result: 'WIN' }));
    await fireEvent.press(screen.getByTestId('filter-type-quick'));
    await waitFor(() => expect(statisticsApi.history).toHaveBeenLastCalledWith({ type: 'ONLINE_RANDOM', result: 'WIN' }));
  });

  it('opens the replay sheet and steps through frames', async () => {
    m(gameApi.replay).mockResolvedValue({
      game: { boardSize: 3, result: { line: [0, 1, 2] } },
      totalMoves: 2,
      frames: [
        { moveNumber: 1, position: 0, mark: 'X', board: ['X', '', '', '', '', '', '', '', ''] },
        { moveNumber: 2, position: 4, mark: 'O', board: ['X', '', '', '', 'O', '', '', '', ''] },
      ],
    });
    await wrap(<GameStatisticsScreen {...props} />);
    await fireEvent.press(await screen.findByTestId('history-g1'));
    expect(gameApi.replay).toHaveBeenCalledWith('g1');
    expect(await screen.findByText('Move 2 of 2 · O at 5')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('replay-prev'));
    expect(screen.getByText('Move 1 of 2 · X at 1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('replay-first'));
    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('shows the empty state and links to local history', async () => {
    m(statisticsApi.history).mockResolvedValue(page([]));
    await wrap(<GameStatisticsScreen {...props} />);
    expect(await screen.findByText('No matches found')).toBeTruthy();
    await fireEvent.press(await screen.findByTestId('open-offline-history'));
    expect(mockNav.nav.navigate).toHaveBeenCalledWith('offline_history');
  });

  it('shows the offline state when stats fail with NETWORK_ERROR', async () => {
    m(statisticsApi.me).mockRejectedValue(new ApiError('NETWORK_ERROR', 'x'));
    await wrap(<GameStatisticsScreen {...props} />);
    expect((await screen.findAllByText('No Internet Connection')).length).toBeGreaterThan(0);
  });
});

describe('AchievementsScreen', () => {
  const mk = (key: string, category: string, unlocked: boolean) => ({ key, name: `Name ${key}`, description: `Desc ${key}`, category, target: 10, reward: { xp: 50, points: 5 }, progress: unlocked ? 10 : 3, unlocked, unlockedAt: null });

  it('derives category chips from data, filters, and shows XP rewards and unlocked count', async () => {
    const items = [mk('a', 'WINS', true), mk('b', 'STREAKS', false), mk('c', 'WINS', false)];
    m(achievementApi.mine).mockResolvedValue({ items, unlockedCount: 1, total: 3, history: [] });
    await wrap(<AchievementsScreen {...props} />);
    expect(await screen.findByText('1 of 3 unlocked')).toBeTruthy();
    expect(screen.getByTestId('ach-filter-All')).toBeTruthy();
    expect(screen.getByTestId('ach-filter-WINS')).toBeTruthy();
    expect(screen.getByTestId('ach-filter-STREAKS')).toBeTruthy();
    expect(screen.queryByText('Strategy')).toBeNull();
    expect(screen.getAllByText('+50 XP')).toHaveLength(3);
    await fireEvent.press(screen.getByTestId('ach-filter-STREAKS'));
    expect(screen.getByText('Name b')).toBeTruthy();
    expect(screen.queryByText('Name a')).toBeNull();
  });

  it('shows an error state with retry', async () => {
    m(achievementApi.mine)
      .mockRejectedValueOnce(new ApiError('INTERNAL', 'boom', 500))
      .mockResolvedValue({ items: [], unlockedCount: 0, total: 0, history: [] });
    await wrap(<AchievementsScreen {...props} />);
    await fireEvent.press(await screen.findByText('Try Again'));
    expect(await screen.findByText('No achievements yet')).toBeTruthy();
  });
});

describe('DailyRewardsScreen', () => {
  const cycle = (claimDay: number) =>
    Array.from({ length: 7 }, (_, i) => ({ day: i + 1, coins: 10 * (i + 1), status: i + 1 < claimDay ? 'claimed' : i + 1 === claimDay ? 'claimable' : 'locked' }));
  const claimable = { timezone: 'UTC', today: '2026-11-17', canClaim: true, claimedToday: false, nextDay: 3, streak: 2, nextClaimAt: null, coins: 120, cycle: cycle(3) };
  const nextAt = () => new Date(Date.now() + (5 * 3600 + 12 * 60 + 40) * 1000).toISOString();

  it('shows balance, streak and claims through the server, then the countdown', async () => {
    m(rewardApi.status).mockResolvedValue(claimable);
    const after = { ...claimable, canClaim: false, claimedToday: true, coins: 150, streak: 3, nextClaimAt: nextAt(), cycle: cycle(4) };
    m(rewardApi.claim).mockResolvedValue({ claimed: { day: 3, coins: 30 }, wallet: { coins: 150 }, status: after });
    await wrap(<DailyRewardsScreen {...props} />);
    expect(await screen.findByText('Claim Day 3 (+30 Coins)')).toBeTruthy();
    expect(screen.getAllByText('120').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('claim-reward'));
    await waitFor(() => expect(rewardApi.claim).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('claim-celebration')).toBeTruthy();
    expect(screen.getByText('+30 coins')).toBeTruthy();
    expect(await screen.findByText(/Next reward in 05:1[12]:\d\d/)).toBeTruthy();
    expect(screen.getAllByText('150').length).toBeGreaterThan(0);
  });

  it('shows the countdown and a disabled button when already claimed', async () => {
    m(rewardApi.status).mockResolvedValue({ ...claimable, canClaim: false, claimedToday: true, nextClaimAt: nextAt(), cycle: cycle(4) });
    await wrap(<DailyRewardsScreen {...props} />);
    expect(await screen.findByText(/Next reward in 05:1[12]:\d\d/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('claim-reward'));
    expect(rewardApi.claim).not.toHaveBeenCalled();
  });

  it('refetches status when the server says the reward is already claimed', async () => {
    m(rewardApi.status).mockResolvedValue(claimable);
    m(rewardApi.claim).mockRejectedValue(new ApiError('REWARD_ALREADY_CLAIMED', 'claimed', 409));
    await wrap(<DailyRewardsScreen {...props} />);
    await fireEvent.press(await screen.findByTestId('claim-reward'));
    await waitFor(() => expect(rewardApi.status).toHaveBeenCalledTimes(2));
  });

  it('toasts other server errors', async () => {
    m(rewardApi.status).mockResolvedValue(claimable);
    m(rewardApi.claim).mockRejectedValue(new ApiError('INTERNAL', 'Server exploded', 500));
    await wrap(<DailyRewardsScreen {...props} />);
    await fireEvent.press(await screen.findByTestId('claim-reward'));
    await waitFor(() => expect(JSON.stringify(useToastStore.getState())).toContain('Could not claim reward'));
    expect(rewardApi.status).toHaveBeenCalledTimes(1);
  });

  it('shows offline state', async () => {
    m(rewardApi.status).mockRejectedValue(new ApiError('NETWORK_ERROR', 'x'));
    await wrap(<DailyRewardsScreen {...props} />);
    expect(await screen.findByText('No Internet Connection')).toBeTruthy();
  });
});
