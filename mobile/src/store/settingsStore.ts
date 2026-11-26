import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ThemeId } from '../design-system/colors';

export type FriendRequestPolicy = 'Everyone' | 'Mutuals' | 'Off';

export interface SettingsState {
  theme: ThemeId;
  soundEffects: boolean;
  vibration: boolean;
  moveConfirm: boolean;
  notifications: boolean;
  language: string;
  onboardingSeen: boolean;
  privacyOnline: boolean;
  privacySpectate: boolean;
  privacyPublicElo: boolean;
  privacyRequests: FriendRequestPolicy;
  equippedEmblem: string;
  unlockedEmblems: Record<string, boolean>;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

/** Non-sensitive preferences only (tokens live in SecureStore). Persisted so offline play keeps them. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      soundEffects: true,
      vibration: true,
      moveConfirm: false,
      notifications: true,
      language: 'en',
      onboardingSeen: false,
      privacyOnline: true,
      privacySpectate: true,
      privacyPublicElo: true,
      privacyRequests: 'Everyone',
      equippedEmblem: 'cobalt',
      unlockedEmblems: { cobalt: true, tactical: true, crown: false, frame: false },
      set: (patch) => set(patch),
    }),
    { name: 'settings-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
