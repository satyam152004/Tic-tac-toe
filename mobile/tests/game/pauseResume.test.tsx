import { renderHook } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { useInterruptionPause } from '../../src/hooks/useInterruptionPause';
import { localGameStorage } from '../../src/services/storage/localGameStorage';
import { DEFAULT_SETUP, useLocalGameStore } from '../../src/store/localGameStore';

const sqlite = jest.requireMock('expo-sqlite') as { __matches: unknown[] };
const st = () => useLocalGameStore.getState();

let now = 1_000_000;
beforeEach(() => {
  sqlite.__matches.length = 0;
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  useLocalGameStore.setState({ setup: DEFAULT_SETUP, game: null, paused: false, pauseReason: null, lastMatchId: null, historyVersion: 0, lastMove: null });
});
afterEach(() => jest.restoreAllMocks());

describe('pause / resume state (store)', () => {
  it('pause is idempotent: no duplicate pause, the first reason wins', () => {
    st().start();
    st().play(0);
    st().pause('interrupted');
    const snapshot = st().game;
    st().pause('manual');
    st().pause('interrupted');
    expect(st().game).toBe(snapshot); // untouched: the timer was frozen exactly once
    expect(st().pauseReason).toBe('interrupted');
    expect(st().paused).toBe(true);
  });

  it('unpause without a pause does nothing', () => {
    st().start();
    const before = st().game;
    st().unpause();
    expect(st().game).toBe(before);
    expect(st().paused).toBe(false);
  });

  it('resume keeps board, turn, scores, moves and history positions', () => {
    st().configure({ size: 4 });
    st().start();
    [0, 5, 10].forEach((p) => st().play(p));
    const before = st().game!;
    st().pause('interrupted');
    st().unpause();
    const after = st().game!;
    expect(after.board).toEqual(before.board);
    expect(after.current).toBe(before.current);
    expect(after.scores).toEqual(before.scores);
    expect(after.moves).toEqual(before.moves);
    expect(st().lastMove).toBe(10);
    expect(st().paused).toBe(false);
    expect(st().pauseReason).toBeNull();
  });

  it('the clock is frozen while paused and continues from the same point after resume', () => {
    st().start();
    now += 5_000;
    st().pause('manual');
    expect(st().elapsedMs()).toBe(5_000);
    now += 10 * 60_000; // ten minutes away
    expect(st().elapsedMs()).toBe(5_000);
    st().unpause();
    now += 3_000;
    expect(st().elapsedMs()).toBe(8_000);
  });

  it('can be paused and resumed many times without drifting', () => {
    st().start();
    for (let i = 0; i < 5; i++) {
      now += 1_000;
      st().pause('manual');
      now += 60_000;
      st().unpause();
    }
    now += 1_000;
    expect(st().elapsedMs()).toBe(6_000);
  });

  it('blocks moves, undo and AI while paused, and allows them after resume', () => {
    st().start();
    st().play(0);
    st().pause('manual');
    expect(st().play(1)).toBe(false);
    st().undoMove();
    expect(st().game?.moves).toHaveLength(1);
    st().unpause();
    expect(st().play(1)).toBe(true);
  });

  it('cannot pause a finished or missing game', () => {
    st().pause('manual');
    expect(st().paused).toBe(false);
    st().start();
    [0, 3, 1, 4, 2].forEach((p) => st().play(p));
    st().pause('interrupted');
    expect(st().paused).toBe(false);
  });

  it('persists the paused snapshot so a killed app does not let the clock run on', async () => {
    st().start();
    now += 4_000;
    st().pause('interrupted');
    now += 60 * 60_000; // process dies, comes back an hour later
    const saved = await localGameStorage.loadActive();
    expect(saved?.state.resumedAt).toBeNull();
    expect(saved?.state.elapsedMs).toBe(4_000);
  });

  it('restart and quit clear the paused state', () => {
    st().start();
    st().pause('manual');
    st().rematch();
    expect(st().paused).toBe(false);
    expect(st().pauseReason).toBeNull();
    st().pause('manual');
    st().quit();
    expect(st().paused).toBe(false);
    expect(st().game).toBeNull();
  });

  it('undo is ignored once the round has finished (no stale history record)', async () => {
    st().start();
    [0, 3, 1, 4, 2].forEach((p) => st().play(p));
    expect(st().game?.outcome.status).toBe('WIN');
    st().undoMove();
    expect(st().game?.outcome.status).toBe('WIN');
    expect(st().game?.moves).toHaveLength(5);
  });
});

describe('useInterruptionPause (AppState)', () => {
  let emit: (s: AppStateStatus) => void;
  const remove = jest.fn();

  beforeEach(() => {
    remove.mockClear();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: (s: AppStateStatus) => void) => {
      emit = handler;
      return { remove };
    }) as never);
  });

  it('pauses on background and stays paused on return: it never auto-resumes', async () => {
    await renderHook(() => useInterruptionPause());
    st().start();
    st().play(4);
    emit('background');
    expect(st().paused).toBe(true);
    expect(st().pauseReason).toBe('interrupted');
    emit('active');
    expect(st().paused).toBe(true);
    st().unpause();
    expect(st().paused).toBe(false);
  });

  it('pauses on iOS inactive (control centre, system alert, app switcher)', async () => {
    await renderHook(() => useInterruptionPause());
    st().start();
    emit('inactive');
    expect(st().paused).toBe(true);
  });

  it('inactive followed by background is one pause (no duplicate, no conflicting update)', async () => {
    await renderHook(() => useInterruptionPause());
    st().start();
    now += 2_000;
    emit('inactive');
    const snapshot = st().game;
    now += 5_000;
    emit('background');
    expect(st().game).toBe(snapshot);
    expect(st().elapsedMs()).toBe(2_000);
  });

  it('works for a guest: it does not depend on being signed in', async () => {
    // No auth store is involved at all; the hook only needs the local game store.
    await renderHook(() => useInterruptionPause());
    st().start();
    emit('background');
    expect(st().paused).toBe(true);
  });

  it('ignores interruptions when there is no running game', async () => {
    await renderHook(() => useInterruptionPause());
    emit('background');
    expect(st().paused).toBe(false);
    st().start();
    [0, 3, 1, 4, 2].forEach((p) => st().play(p));
    emit('background');
    expect(st().paused).toBe(false);
  });

  it('removes its listener on unmount', async () => {
    const { unmount } = await renderHook(() => useInterruptionPause());
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
