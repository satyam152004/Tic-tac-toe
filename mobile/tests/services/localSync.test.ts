import { newLocalGame, playMove, toMatchRecord } from '../../src/game-engine';
import { statisticsApi } from '../../src/services/api/statisticsApi';
import { syncLocalMatches } from '../../src/services/localSync';
import { localGameStorage } from '../../src/services/storage/localGameStorage';

jest.mock('../../src/services/api/statisticsApi', () => ({ statisticsApi: { syncLocalMatches: jest.fn() } }));
const sync = statisticsApi.syncLocalMatches as jest.Mock;

function xWins() {
  let g = newLocalGame({ mode: 'LOCAL_2P', size: 3 });
  for (const p of [0, 3, 1, 4, 2]) g = playMove(g, p);
  return toMatchRecord(g);
}

beforeEach(async () => {
  sync.mockReset();
  await localGameStorage.clearMatches();
});

describe('local match storage + sync', () => {
  it('stores a finished match once per clientMatchId and lists newest first', async () => {
    const id = await localGameStorage.saveMatch(xWins(), 'Ann', 'Bob', 'client-1');
    await localGameStorage.saveMatch(xWins(), 'Ann', 'Bob', 'client-1'); // duplicate
    await localGameStorage.saveMatch(xWins(), 'Cy', 'Di', 'client-2');
    expect(id).toBe('client-1');
    const list = await localGameStorage.listMatches();
    expect(list.map((m) => m.clientMatchId)).toEqual(['client-2', 'client-1']);
    expect(list[1]!.record.result).toBe('X');
  });

  it('uploads unsynced matches in the server format and marks them synced', async () => {
    await localGameStorage.saveMatch(xWins(), 'Ann', 'Bob', 'client-1');
    sync.mockResolvedValue({ accepted: 1, duplicates: 0, rejected: [] });
    const n = await syncLocalMatches();
    expect(n).toBe(1);
    const payload = sync.mock.calls[0]![0][0];
    expect(payload).toMatchObject({ clientMatchId: 'client-1', size: 3, winLength: 3, mode: 'LOCAL_2P', moves: [0, 3, 1, 4, 2] });
    expect(payload.humanMark).toBeUndefined();
    expect((await localGameStorage.unsynced()).length).toBe(0);
  });

  it('keeps matches queued when the network fails and never loses them', async () => {
    await localGameStorage.saveMatch(xWins(), 'Ann', 'Bob', 'client-1');
    sync.mockRejectedValue(Object.assign(new Error('Network Error'), { code: 'NETWORK_ERROR' }));
    expect(await syncLocalMatches()).toBe(0);
    expect((await localGameStorage.unsynced()).length).toBe(1);
    sync.mockResolvedValue({ accepted: 1, duplicates: 0, rejected: [] });
    expect(await syncLocalMatches()).toBe(1);
  });

  it('does not duplicate results: a server "duplicate" answer still completes the entry', async () => {
    await localGameStorage.saveMatch(xWins(), 'Ann', 'Bob', 'client-1');
    sync.mockResolvedValue({ accepted: 0, duplicates: 1, rejected: [] });
    expect(await syncLocalMatches()).toBe(0);
    expect((await localGameStorage.unsynced()).length).toBe(0);
    sync.mockClear();
    await syncLocalMatches();
    expect(sync).not.toHaveBeenCalled(); // nothing left to send
  });

  it('shares a single in-flight run between concurrent triggers', async () => {
    await localGameStorage.saveMatch(xWins(), 'Ann', 'Bob', 'client-1');
    let release: () => void = () => undefined;
    sync.mockImplementation(() => new Promise((r) => (release = () => r({ accepted: 1, duplicates: 0, rejected: [] }))));
    const a = syncLocalMatches();
    const b = syncLocalMatches();
    await new Promise((r) => setTimeout(r, 10));
    release();
    await Promise.all([a, b]);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('persists and clears the interrupted active game', async () => {
    const state = newLocalGame({ mode: 'VS_AI', size: 4, difficulty: 'HARD' });
    await localGameStorage.saveActive({ state, p1Name: 'A', p2Name: 'B', p1Avatar: 'av_1', p2Avatar: 'av_2', p1Mark: 'X', savedAt: 1 });
    expect((await localGameStorage.loadActive())?.state.config.size).toBe(4);
    await localGameStorage.clearActive();
    expect(await localGameStorage.loadActive()).toBeNull();
  });
});
