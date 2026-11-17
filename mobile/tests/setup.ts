/* Global Jest setup: native modules are replaced with in-memory fakes so tests run in plain Node. */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
    __store: store,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(), notificationAsync: jest.fn(), selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), seekTo: jest.fn(async () => undefined), remove: jest.fn() })),
  setAudioModeAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
});

jest.mock('expo-sqlite', () => {
  // Minimal in-memory SQLite stand-in covering the statements localGameStorage uses.
  const matches: Array<Record<string, unknown>> = [];
  let active: string | null = null;
  let id = 0;
  const db = {
    execAsync: jest.fn(async () => undefined),
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    runAsync: jest.fn(async (sql: string, ...p: unknown[]) => {
      if (/INSERT OR IGNORE INTO local_matches/.test(sql)) {
        if (!matches.some((m) => m.client_match_id === p[0])) matches.push({ id: ++id, client_match_id: p[0], payload: p[1], p1_name: p[2], p2_name: p[3], played_at: p[4], synced: 0 });
      } else if (/UPDATE local_matches SET synced = 1/.test(sql)) {
        matches.filter((m) => m.client_match_id === p[0]).forEach((m) => (m.synced = 1));
      } else if (/DELETE FROM local_matches WHERE id/.test(sql)) {
        const i = matches.findIndex((m) => m.id === p[0]);
        if (i >= 0) matches.splice(i, 1);
      } else if (/DELETE FROM local_matches/.test(sql)) matches.length = 0;
      else if (/INSERT OR REPLACE INTO local_active/.test(sql)) active = p[1] as string;
      else if (/DELETE FROM local_active/.test(sql)) active = null;
    }),
    getAllAsync: jest.fn(async (sql: string, limit: number) => {
      let rows = [...matches];
      if (/synced = 0/.test(sql)) rows = rows.filter((m) => m.synced === 0);
      rows.sort((a, b) => (/DESC/.test(sql) ? (b.id as number) - (a.id as number) : (a.id as number) - (b.id as number)));
      return rows.slice(0, limit);
    }),
    getFirstAsync: jest.fn(async () => (active ? { payload: active } : null)),
  };
  return { openDatabaseAsync: jest.fn(async () => db), __matches: matches };
});

jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    SafeAreaInsetsContext: React.createContext(insets),
    initialWindowMetrics: { frame: { x: 0, y: 0, width: 390, height: 844 }, insets },
  };
});

jest.mock('react-native-reanimated', () => require('./mocks/reanimated'));
