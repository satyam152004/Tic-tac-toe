import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { queryClient } from '../services/queryClient';
import { authApi } from '../services/api/authApi';
import { setSessionExpiredHandler } from '../services/api/apiClient';
import { toApiError } from '../services/api/errors';
import type { Me, ThemeId } from '../services/api/types';
import { userApi } from '../services/api/userApi';
import { socketClient } from '../services/socket/socketClient';
import { tokenStorage } from '../services/storage/secureStorage';
import { isThemeId } from '../design-system/themes';
import { useSettingsStore } from './settingsStore';

const CACHE_KEY = 'me-cache-v1';

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
  /** Signed-in guest -> registered via Google/Apple, keeping all progress. */
  upgradeGuestSocial: (provider: 'google' | 'apple', token: string) => Promise<Me>;
  /** Google/Apple account adds a password (emailed code). Sessions are replaced by the fresh ones the server returns. */
  setPassword: (code: string, newPassword: string) => Promise<Me>;
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

    signIn: async (email, password) => enter((await authApi.login(email, password)).user, true),
    register: async (input) => enter((await authApi.register(input)).user, true),
    continueAsGuest: async () => enter((await authApi.guest()).user, true),
    upgradeGuest: async (input) => enter((await authApi.upgradeGuest(input)).user, false),
    upgradeGuestSocial: async (provider, token) =>
      enter((await (provider === 'google' ? authApi.upgradeGoogle(token) : authApi.upgradeApple(token))).user, false),
    setPassword: async (code, newPassword) => enter((await authApi.setPassword(code, newPassword)).user, false),
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
