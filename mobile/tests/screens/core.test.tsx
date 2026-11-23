import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { Me } from '../../src/services/api/types';

// lucide-react-native resolves to an ESM build that jest cannot require; icons are irrelevant here.
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : () => null) }));

const mockNav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true), dispatch: jest.fn() };
const mockApp = { nav: mockNav, goTab: jest.fn(), goHome: jest.fn(), resetTo: jest.fn(), back: jest.fn() };
jest.mock('../../src/navigation/useAppNav', () => ({ useAppNav: () => mockApp }));
jest.mock('@react-navigation/native', () => {
  const R = require('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(cb, [cb]), useNavigation: () => mockNav };
});

const mockSocial = {
  signInWithGoogle: jest.fn(async () => undefined),
  signInWithApple: jest.fn(async () => undefined),
  socialProviders: { google: true, apple: true },
};
jest.mock('../../src/services/socialAuth', () => ({
  signInWithGoogle: (...a: unknown[]) => (mockSocial.signInWithGoogle as any)(...a),
  signInWithApple: (...a: unknown[]) => (mockSocial.signInWithApple as any)(...a),
  get socialProviders() { return mockSocial.socialProviders; },
}));

let mockMe: { data?: Me; isError: boolean; error: unknown; refetch: jest.Mock };
jest.mock('../../src/hooks/queries', () => ({
  useMe: () => mockMe,
  useNotifications: () => ({ data: { items: [], unread: 3, total: 3 }, refetch: jest.fn() }),
  useStreaks: () => ({ data: { currentStreak: 2, bestStreak: 5, recentForm: ['WIN', 'WIN', 'LOSS', 'DRAW'] }, refetch: jest.fn() }),
  useLeaderboard: () => ({ data: { rows: [], total: 40, me: { rank: 14, points: 1200, wins: 17 } }, refetch: jest.fn() }),
  useDailyReward: () => ({ data: { canClaim: true }, refetch: jest.fn() }),
}));

const mockLoadActive = jest.fn();
const mockClearActive = jest.fn(async () => undefined);
jest.mock('../../src/services/storage/localGameStorage', () => ({
  localGameStorage: { saveActive: async () => undefined, saveMatch: async () => 'id', loadActive: () => mockLoadActive(), clearActive: () => mockClearActive() },
}));

import { SplashScreen } from '../../src/screens/onboarding/SplashScreen';
import { Onboarding1Screen, Onboarding3Screen } from '../../src/screens/onboarding/OnboardingScreens';
import { WelcomeScreen } from '../../src/screens/onboarding/WelcomeScreen';
import { HomeScreen } from '../../src/screens/home/HomeScreen';
import { GameModeScreen } from '../../src/screens/home/GameModeScreen';
import { PlayerSetupScreen } from '../../src/screens/home/PlayerSetupScreen';
import { GameRulesScreen } from '../../src/screens/home/GameRulesScreen';
import { useAuthStore } from '../../src/store/authStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useLocalGameStore, DEFAULT_SETUP } from '../../src/store/localGameStore';
import { useToastStore } from '../../src/store/toastStore';
import { newLocalGame } from '../../src/game-engine';

const props = (name: string, params?: object) => ({ navigation: mockNav, route: { key: name, name, params } }) as any;

const makeMe = (over: Partial<Me> = {}): Me => ({
  id: 'u1', username: 'aiden', displayName: 'Aiden', email: 'a@b.c', emailVerified: true, avatar: 'av_1', bio: '', timezone: 'UTC',
  wallet: { coins: 420 }, accountType: 'REGISTERED', theme: 'dark', language: 'en',
  sound: { effects: true, music: true, volume: 1 }, notificationPrefs: { social: true, game: true, achievements: true, account: true },
  online: true, lastActiveAt: '', createdAt: '',
  stats: { totalGames: 30, wins: 17, losses: 9, draws: 4, winPercentage: 56.6, points: 1200, xp: 150, level: 4, xpForCurrentLevel: 100, xpForNextLevel: 200, currentStreak: 2, bestStreak: 5, totalPlayTimeSec: 0, averageGameDurationSec: 0, aiGames: 0, aiWins: 0, onlineGames: 0, onlineWins: 0, local: { games: 0, wins: 0, losses: 0, draws: 0 } },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMe = { data: makeMe(), isError: false, error: null, refetch: jest.fn(async () => undefined) };
  mockLoadActive.mockResolvedValue(null);
  useAuthStore.setState({ status: 'signedIn', user: makeMe(), offline: false, bootstrap: jest.fn(async () => undefined) } as never);
  useSettingsStore.setState({ onboardingSeen: false });
  useLocalGameStore.setState({ setup: DEFAULT_SETUP, game: null });
  useToastStore.setState({ toast: null });
});

describe('SplashScreen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('bootstraps once and goes to Main when signed in after the minimum time', async () => {
    await render(<SplashScreen {...props('splash')} />);
    expect(useAuthStore.getState().bootstrap).toHaveBeenCalledTimes(1);
    expect(mockApp.resetTo).not.toHaveBeenCalled();
    await act(async () => void jest.advanceTimersByTime(1500));
    expect(mockApp.resetTo).toHaveBeenCalledTimes(1);
    expect(mockApp.resetTo).toHaveBeenCalledWith('Main');
  });

  it('goes to onboarding when signed out and not seen, welcome when seen', async () => {
    useAuthStore.setState({ status: 'signedOut', user: null } as never);
    const first = await render(<SplashScreen {...props('splash')} />);
    await act(async () => void jest.advanceTimersByTime(1500));
    expect(mockApp.resetTo).toHaveBeenLastCalledWith('onboarding_1');
    await first.unmount();
    mockApp.resetTo.mockClear();
    useSettingsStore.setState({ onboardingSeen: true });
    await render(<SplashScreen {...props('splash')} />);
    await act(async () => void jest.advanceTimersByTime(1500));
    expect(mockApp.resetTo).toHaveBeenCalledWith('welcome');
  });

  it('waits while the auth store is still booting', async () => {
    useAuthStore.setState({ status: 'booting' } as never);
    await render(<SplashScreen {...props('splash')} />);
    await act(async () => void jest.advanceTimersByTime(3000));
    expect(mockApp.resetTo).not.toHaveBeenCalled();
    await act(async () => useAuthStore.setState({ status: 'signedOut' } as never));
    expect(mockApp.resetTo).toHaveBeenCalledTimes(1);
  });
});

describe('Onboarding', () => {
  it('Next moves to the following page', async () => {
    await render(<Onboarding1Screen {...props('onboarding_1')} />);
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(mockNav.navigate).toHaveBeenCalledWith('onboarding_2');
  });

  it('Skip marks onboarding seen and goes to welcome', async () => {
    await render(<Onboarding1Screen {...props('onboarding_1')} />);
    await fireEvent.press(screen.getByTestId('onboarding-skip'));
    expect(useSettingsStore.getState().onboardingSeen).toBe(true);
    expect(mockNav.navigate).toHaveBeenCalledWith('welcome');
  });

  it('Get Started on the last page finishes onboarding', async () => {
    await render(<Onboarding3Screen {...props('onboarding_3')} />);
    await fireEvent.press(screen.getByText('Get Started'));
    expect(useSettingsStore.getState().onboardingSeen).toBe(true);
    expect(mockNav.navigate).toHaveBeenCalledWith('welcome');
  });
});

describe('WelcomeScreen', () => {
  it('continues as guest and resets to Main', async () => {
    const guest = jest.fn(async () => makeMe({ accountType: 'GUEST' }));
    useAuthStore.setState({ continueAsGuest: guest } as never);
    await render(<WelcomeScreen {...props('welcome')} />);
    await fireEvent.press(screen.getByTestId('welcome-guest'));
    await waitFor(() => expect(mockApp.resetTo).toHaveBeenCalledWith('Main'));
    expect(guest).toHaveBeenCalled();
  });

  it('shows a toast when guest sign-in fails', async () => {
    useAuthStore.setState({ continueAsGuest: jest.fn(async () => { throw new Error('boom'); }) } as never);
    await render(<WelcomeScreen {...props('welcome')} />);
    await fireEvent.press(screen.getByTestId('welcome-guest'));
    await waitFor(() => expect(useToastStore.getState().toast).not.toBeNull());
    expect(mockApp.resetTo).not.toHaveBeenCalled();
  });

  it('ignores a cancelled social sign-in silently and navigates to login for email', async () => {
    mockSocial.signInWithGoogle.mockRejectedValueOnce(new Error('CANCELLED'));
    await render(<WelcomeScreen {...props('welcome')} />);
    await fireEvent.press(screen.getByTestId('welcome-google'));
    await waitFor(() => expect(mockSocial.signInWithGoogle).toHaveBeenCalled());
    expect(useToastStore.getState().toast).toBeNull();
    expect(mockApp.resetTo).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('welcome-email'));
    expect(mockNav.navigate).toHaveBeenCalledWith('login');
  });
});

describe('PlayerSetupScreen', () => {
  it('defaults player 1 to the signed-in display name and starts a game', async () => {
    await render(<PlayerSetupScreen {...props('player_setup', { mode: 'LOCAL_2P' })} />);
    expect(screen.getByTestId('p1-name').props.value).toBe('Aiden');
    await fireEvent.press(screen.getByTestId('setup-start'));
    const st = useLocalGameStore.getState();
    expect(st.setup).toMatchObject({ mode: 'LOCAL_2P', size: 3, p1Name: 'Aiden' });
    expect(st.game).not.toBeNull();
    expect(mockNav.navigate).toHaveBeenCalledWith('offline_board');
  });

  it('rejects empty and identical names', async () => {
    await render(<PlayerSetupScreen {...props('player_setup', { mode: 'LOCAL_2P' })} />);
    await fireEvent.changeText(screen.getByTestId('p2-name'), 'aiden');
    await fireEvent.press(screen.getByTestId('setup-start'));
    expect(screen.getByText('Players need different names')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('p1-name'), '   ');
    await fireEvent.press(screen.getByTestId('setup-start'));
    expect(screen.getByText('Enter a name for Player 1')).toBeTruthy();
    expect(mockNav.navigate).not.toHaveBeenCalledWith('offline_board');
  });

  it('hides player 2 for VS_AI and keeps the stored difficulty', async () => {
    useLocalGameStore.getState().configure({ difficulty: 'HARD' });
    await render(<PlayerSetupScreen {...props('player_setup', { mode: 'VS_AI' })} />);
    expect(screen.queryByTestId('p2-name')).toBeNull();
    await fireEvent.press(screen.getByTestId('setup-start'));
    expect(useLocalGameStore.getState().setup).toMatchObject({ mode: 'VS_AI', difficulty: 'HARD' });
  });
});

describe('GameModeScreen', () => {
  it('navigates to each mode', async () => {
    await render(<GameModeScreen />);
    await fireEvent.press(screen.getByTestId('mode-local'));
    await fireEvent.press(screen.getByTestId('mode-continue'));
    expect(mockNav.navigate).toHaveBeenCalledWith('board_selection', { mode: 'LOCAL_2P' });
    await fireEvent.press(screen.getByTestId('mode-ai'));
    await fireEvent.press(screen.getByTestId('mode-continue'));
    expect(mockNav.navigate).toHaveBeenCalledWith('ai_difficulty');
    await fireEvent.press(screen.getByTestId('mode-online'));
    await fireEvent.press(screen.getByTestId('mode-continue'));
    expect(mockNav.navigate).toHaveBeenCalledWith('online_lobby');
  });

  it('shows an offline message instead of opening online modes', async () => {
    useAuthStore.setState({ offline: true } as never);
    await render(<GameModeScreen />);
    await fireEvent.press(screen.getByTestId('mode-online'));
    await fireEvent.press(screen.getByTestId('mode-continue'));
    expect(mockNav.navigate).not.toHaveBeenCalledWith('online_lobby');
    expect(useToastStore.getState().toast).not.toBeNull();
  });
});

describe('HomeScreen', () => {
  it('renders level, coins and real stats', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('Aiden')).toBeTruthy();
    expect(screen.getByText('420')).toBeTruthy();
    expect(screen.getByText('17 Wins')).toBeTruthy();
    expect(screen.getByText('50% Rate')).toBeTruthy();
    expect(screen.getByText('Last 4')).toBeTruthy();
    expect(screen.getByText('#14 Rank')).toBeTruthy();
    expect(screen.queryByTestId('upgrade-card')).toBeNull();
    expect(screen.getByLabelText('Notifications, 3 unread')).toBeTruthy();
  });

  it('prompts guests to upgrade before Online Arena and shows the offline banner', async () => {
    useAuthStore.setState({ user: makeMe({ accountType: 'GUEST' }), offline: false } as never);
    mockMe = { ...mockMe, data: makeMe({ accountType: 'GUEST' }) };
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByLabelText('Online Arena'));
    expect(mockNav.navigate).not.toHaveBeenCalledWith('online_lobby');
    await fireEvent.press(screen.getByTestId('guest-upgrade-submit'));
    expect(mockNav.navigate).toHaveBeenCalledWith('registration');
  });

  it('offers to resume an interrupted local match and can discard it', async () => {
    const state = newLocalGame({ mode: 'LOCAL_2P', size: 3, difficulty: 'MEDIUM', humanMark: 'X' } as never);
    const active = { state, p1Name: 'A', p2Name: 'B', p1Avatar: 'av_1', p2Avatar: 'av_2', p1Mark: 'X', savedAt: 1 };
    mockLoadActive.mockResolvedValue(active);
    const resume = jest.fn();
    useLocalGameStore.setState({ resume } as never);
    await render(<HomeScreen />);
    await fireEvent.press(await screen.findByTestId('resume-match'));
    expect(resume).toHaveBeenCalledWith(active);
    expect(mockNav.navigate).toHaveBeenCalledWith('offline_board');
    await fireEvent.press(screen.getByTestId('discard-match'));
    await waitFor(() => expect(screen.queryByTestId('resume-card')).toBeNull());
    expect(mockClearActive).toHaveBeenCalled();
  });

  it('shows a loader when there is no profile yet', async () => {
    mockMe = { ...mockMe, data: undefined };
    await render(<HomeScreen />);
    expect(screen.getByLabelText('Loading your arena')).toBeTruthy();
  });
});

describe('GameRulesScreen', () => {
  it('lists the real win lengths', async () => {
    await render(<GameRulesScreen {...props('game_rules')} />);
    expect(screen.getByTestId('rule-3').props.children).toContain('Align 3 marks');
    expect(screen.getByTestId('rule-4').props.children).toContain('Connect 4 marks');
    expect(screen.getByTestId('rule-5').props.children).toContain('Connect 4 marks');
  });
});
