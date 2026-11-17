import * as SecureStore from 'expo-secure-store';
import type { Tokens } from '../api/types';

/**
 * SECURE TOKEN STORAGE (iOS Keychain / Android Keystore via expo-secure-store).
 *  - refresh token + expiry: persisted in SecureStore (encrypted, not in backups on iOS with THIS_DEVICE_ONLY)
 *  - access token (15 min): memory only, re-obtained with the refresh token
 * Tokens are never put in AsyncStorage, SQLite, logs or analytics.
 */
const KEY = 'tictactoe.session.v1';

interface Persisted {
  refreshToken: string;
  refreshExpiresAt: string;
}

let memory: Tokens | null = null;
const listeners = new Set<(t: Tokens | null) => void>();

export const tokenStorage = {
  /** Loads the persisted refresh token. The access token is empty until the first refresh. */
  async load(): Promise<Tokens | null> {
    if (memory) return memory;
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (!raw) return null;
      const p = JSON.parse(raw) as Persisted;
      if (!p.refreshToken || new Date(p.refreshExpiresAt).getTime() < Date.now()) {
        await SecureStore.deleteItemAsync(KEY);
        return null;
      }
      memory = { accessToken: '', refreshToken: p.refreshToken, tokenType: 'Bearer', expiresIn: 0, refreshExpiresAt: p.refreshExpiresAt };
      return memory;
    } catch {
      await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
      return null;
    }
  },

  async save(tokens: Tokens): Promise<void> {
    memory = tokens;
    const p: Persisted = { refreshToken: tokens.refreshToken, refreshExpiresAt: tokens.refreshExpiresAt };
    await SecureStore.setItemAsync(KEY, JSON.stringify(p), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
    listeners.forEach((l) => l(tokens));
  },

  async clear(): Promise<void> {
    memory = null;
    await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
    listeners.forEach((l) => l(null));
  },

  current(): Tokens | null {
    return memory;
  },

  subscribe(fn: (t: Tokens | null) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
