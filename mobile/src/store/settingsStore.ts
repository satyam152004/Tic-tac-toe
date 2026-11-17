import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ThemeId } from '../design-system/colors';

export interface SettingsState {
  theme: ThemeId;
  soundEffects: boolean;
  music: boolean;
  vibration: boolean;
  notifications: boolean;
  language: string;
  onboardingSeen: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

/** Non-sensitive preferences only (tokens live in SecureStore). Persisted so offline play keeps them. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      soundEffects: true,
      music: true,
      vibration: true,
      notifications: true,
      language: 'en',
      onboardingSeen: false,
      set: (patch) => set(patch),
    }),
    { name: 'settings-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
