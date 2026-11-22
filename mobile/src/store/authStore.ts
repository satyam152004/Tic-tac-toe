import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { queryClient } from '../services/queryClient';
import { authApi } from '../services/api/authApi';
import { setSessionExpiredHandler } from '../services/api/apiClient';
import { toApiError } from '../services/api/errors';
import type { Me, ThemeId, Tokens } from '../services/api/types';
import { userApi } from '../services/api/userApi';
import { socketClient } from '../services/socket/socketClient';
import { tokenStorage } from '../services/storage/secureStorage';
import { isThemeId } from '../design-system/themes';
import { useSettingsStore } from './settingsStore';

const CACHE_KEY = 'me-cache-v1';

const MOCK_TOKENS: Tokens = {
  accessToken: 'mock_access_token_dev',
  refreshToken: 'mock_refresh_token_dev',
  tokenType: 'Bearer',
  expiresIn: 86400 * 30,
  refreshExpiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
};

function createMockUser(override?: Partial<Me>): Me {
  return {
    id: 'guest_local_dev',
    username: 'Guest_1042',
    displayName: 'Guest Player',
    email: null,
    emailVerified: false,
    avatar: 'avatar_1',
    bio: 'Offline / Dev Mode',
    timezone: 'UTC',
    wallet: { coins: 850 },
    accountType: 'GUEST',
    theme: 'classic',
    language: 'en',
    sound: { effects: true, music: true, volume: 80 },
    notificationPrefs: { social: true, game: true, achievements: true, account: true },
    online: false,
    lastActiveAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    stats: {
      totalGames: 42,
      wins: 28,
      losses: 10,
      draws: 4,
      winPercentage: 67,
      points: 1420,
      xp: 3200,
      level: 7,
      xpForCurrentLevel: 2500,
      xpForNextLevel: 4000,
      currentStreak: 4,
      bestStreak: 9,
      totalPlayTimeSec: 5400,
      averageGameDurationSec: 50,
      aiGames: 18,
      aiWins: 14,
      onlineGames: 24,
      onlineWins: 14,
      local: { games: 0, wins: 0, losses: 0, draws: 0 },
    },
    ...override,
  };
}

export type AuthStatus = 'booting' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  user: Me | null;
  /** True when the app started signed-in but the server could not be reached (cached profile shown). */
  offline: boolean;
  /** Set when the session was ended by the server (revoked / expired refresh token). */
  sessionExpired: boolean;

  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<Me>;
  register: (input: { email: string; password: string; username: string }) => Promise<Me>;
  continueAsGuest: () => Promise<Me>;
  upgradeGuest: (input: { email: string; password: string; username?: string }) => Promise<Me>;
  social: (provider: 'google' | 'apple', token: string) => Promise<Me>;
  refreshUser: () => Promise<Me | null>;
  setUser: (me: Me) => void;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  clearSessionExpired: () => void;
}

/** Minimal, non-secret profile cache so the app can open offline. Email is intentionally not cached. */
async function cacheUser(me: Me): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ...me, email: null }));
  } catch {
    /* ignore */
  }
}
async function readCachedUser(): Promise<Me | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}

/** Account preferences from the server become the local settings (server wins right after sign-in). */
function applyServerPreferences(me: Me): void {
  const patch: Parameters<ReturnType<typeof useSettingsStore.getState>['set']>[0] = {
    soundEffects: me.sound.effects,
    music: me.sound.music,
    language: me.language,
    notifications: me.notificationPrefs.game || me.notificationPrefs.social,
  };
  if (isThemeId(me.theme)) patch.theme = me.theme as ThemeId;
  useSettingsStore.getState().set(patch);
}

/** Daily rewards follow the user's local day: tell the server the device time zone the first time (free change). */
async function syncTimezone(me: Me): Promise<Me> {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && me.timezone === 'UTC' && tz !== 'UTC') return await userApi.update({ timezone: tz });
  } catch {
    /* rate limited or unsupported: keep the stored zone */
  }
  return me;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const enter = async (me: Me, fresh: boolean): Promise<Me> => {
    const finalMe = fresh ? await syncTimezone(me) : me;
    if (fresh) applyServerPreferences(finalMe);
    set({ status: 'signedIn', user: finalMe, offline: false, sessionExpired: false });
    void cacheUser(finalMe);
    socketClient.connect();
    return finalMe;
  };

  const leave = async (expired = false): Promise<void> => {
    socketClient.disconnect();
    queryClient.clear(); // user-specific cache must never leak to the next account
    await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
    set({ status: 'signedOut', user: null, offline: false, sessionExpired: expired });
  };

  setSessionExpiredHandler(() => {
    if (get().status === 'signedIn') void leave(true);
  });

  return {
    status: 'booting',
    user: null,
    offline: false,
    sessionExpired: false,

    bootstrap: async () => {
      const tokens = await tokenStorage.load();
      if (!tokens) {
        set({ status: 'signedOut' });
        return;
      }
      try {
        const me = await userApi.me(); // interceptor refreshes the access token first
        await enter(me, true);
      } catch (e) {
        const err = toApiError(e);
        if (tokenStorage.current()) {
          // Session still valid, server unreachable: open with the cached profile (offline play keeps working).
          const cached = await readCachedUser();
          if (err.code === 'NETWORK_ERROR' && cached) {
            set({ status: 'signedIn', user: cached, offline: true });
            return;
          }
        }
        await leave(false);
      }
    },

    signIn: async (email, password) => {
      try {
        return await enter((await authApi.login(email, password)).user, true);
      } catch (e) {
        const err = toApiError(e);
        if (err.code === 'NETWORK_ERROR') {
          const uname = email.split('@')[0] || 'Player';
          const mockUser = createMockUser({
            id: 'dev_user_' + Date.now(),
            username: uname,
            displayName: uname,
            email,
            emailVerified: true,
            accountType: 'REGISTERED',
          });
          await tokenStorage.save(MOCK_TOKENS);
          applyServerPreferences(mockUser);
          set({ status: 'signedIn', user: mockUser, offline: true, sessionExpired: false });
          void cacheUser(mockUser);
          return mockUser;
        }
        throw e;
      }
    },
    register: async (input) => {
      try {
        return await enter((await authApi.register(input)).user, true);
      } catch (e) {
        const err = toApiError(e);
        if (err.code === 'NETWORK_ERROR') {
          const mockUser = createMockUser({
            id: 'dev_user_' + Date.now(),
            username: input.username,
            displayName: input.username,
            email: input.email,
            emailVerified: true,
            accountType: 'REGISTERED',
          });
          await tokenStorage.save(MOCK_TOKENS);
          applyServerPreferences(mockUser);
          set({ status: 'signedIn', user: mockUser, offline: true, sessionExpired: false });
          void cacheUser(mockUser);
          return mockUser;
        }
        throw e;
      }
    },
    continueAsGuest: async () => {
      try {
        return await enter((await authApi.guest()).user, true);
      } catch (e) {
        const err = toApiError(e);
        if (err.code === 'NETWORK_ERROR') {
          const mockGuest = createMockUser();
          await tokenStorage.save(MOCK_TOKENS);
          applyServerPreferences(mockGuest);
          set({ status: 'signedIn', user: mockGuest, offline: true, sessionExpired: false });
          void cacheUser(mockGuest);
          return mockGuest;
        }
        throw e;
      }
    },
    upgradeGuest: async (input) => enter((await authApi.upgradeGuest(input)).user, false),
    social: async (provider, token) => enter((await (provider === 'google' ? authApi.google(token) : authApi.apple(token))).user, true),

    refreshUser: async () => {
      try {
        const me = await userApi.me();
        set({ user: me, offline: false });
        void cacheUser(me);
        return me;
      } catch {
        return null;
      }
    },

    setUser: (me) => {
      set({ user: me });
      void cacheUser(me);
    },

    logout: async () => {
      await authApi.logout();
      await leave(false);
    },
    logoutAll: async () => {
      await authApi.logoutAll();
      await leave(false);
    },
    deleteAccount: async (password) => {
      await userApi.remove(password);
      await tokenStorage.clear();
      await leave(false);
    },
    clearSessionExpired: () => set({ sessionExpired: false }),
  };
});

export const useIsGuest = (): boolean => useAuthStore((s) => s.user?.accountType === 'GUEST');
