import * as Keychain from 'react-native-keychain';
import type { Tokens } from './types';

/**
 * SECURE TOKEN STORAGE
 *
 * React Native has no browser cookie jar you can rely on, so the backend takes the refresh token in the request body and
 * YOU must store it safely:
 *   - refresh token (long lived)  -> iOS Keychain / Android Keystore via react-native-keychain  (this file)
 *   - access token (15 min)       -> memory only; it is cheap to re-obtain with the refresh token
 *   - NEVER put tokens in AsyncStorage / MMKV (unencrypted), logs, analytics or crash reports.
 */
const SERVICE = 'tictactoe.auth';

let memory: Tokens | null = null;
const listeners = new Set<(t: Tokens | null) => void>();

export const tokenStorage = {
  async load(): Promise<Tokens | null> {
    if (memory) return memory;
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    if (!creds) return null;
    try {
      memory = JSON.parse(creds.password) as Tokens;
    } catch {
      await Keychain.resetGenericPassword({ service: SERVICE });
      memory = null;
    }
    return memory;
  },

  async save(tokens: Tokens): Promise<void> {
    memory = tokens;
    await Keychain.setGenericPassword('session', JSON.stringify(tokens), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY, // not restored to another device from a backup
    });
    listeners.forEach((l) => l(tokens));
  },

  async clear(): Promise<void> {
    memory = null;
    await Keychain.resetGenericPassword({ service: SERVICE });
    listeners.forEach((l) => l(null));
  },

  /** Synchronous access for interceptors (call load() once at app start). */
  current(): Tokens | null {
    return memory;
  },

  subscribe(fn: (t: Tokens | null) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
