import { gameFixture } from '../mocks/onlineFixtures';

const mockMove = jest.fn();
const mockRestMove = jest.fn();
jest.mock('../../src/services/socket/socketClient', () => ({
  socketClient: { connected: true, newId: jest.fn(() => 'client-move-id-1'), whenReady: jest.fn(async () => undefined), request: jest.fn(), on: jest.fn(), onStatus: jest.fn() },
}));
jest.mock('../../src/services/socket/gameSocket', () => ({ gameSocket: { move: (...a: unknown[]) => mockMove(...a), join: jest.fn(), forfeit: jest.fn(), rematch: jest.fn() } }));
jest.mock('../../src/services/socket/matchmakingSocket', () => ({ matchmakingSocket: { join: jest.fn(), cancel: jest.fn() }, roomSocket: {} }));
jest.mock('../../src/services/api/gameApi', () => ({ gameApi: { move: (...a: unknown[]) => mockRestMove(...a), get: jest.fn(async () => undefined) } }));
jest.mock('../../src/services/api/roomApi', () => ({ roomApi: {} }));

import { submitMove } from '../../src/services/onlineActions';
import { useOnlineStore } from '../../src/store/onlineStore';

const store = () => useOnlineStore.getState();

beforeEach(() => {
  store().reset();
  mockMove.mockReset();
  mockRestMove.mockReset();
});

describe('onlineStore.applyGame monotonicity', () => {
  it('ignores a late event with a lower moveCount', () => {
    store().applyGame(gameFixture({ moveCount: 3, board: ['X', 'O', 'X', '', '', '', '', '', ''] }));
    store().applyGame(gameFixture({ moveCount: 2, board: ['X', 'O', '', '', '', '', '', '', ''] }));
    expect(store().game?.moveCount).toBe(3);
    expect(store().game?.board[2]).toBe('X');
  });

  it('accepts newer snapshots', () => {
    store().applyGame(gameFixture({ moveCount: 1 }));
    store().applyGame(gameFixture({ moveCount: 2 }));
    expect(store().game?.moveCount).toBe(2);
  });

  it('keeps a terminal game final (a stale in-progress snapshot cannot revive it)', () => {
    store().applyGame(gameFixture({ status: 'COMPLETED', moveCount: 5 }));
    store().applyGame(gameFixture({ status: 'IN_PROGRESS', moveCount: 9 }));
    expect(store().game?.status).toBe('COMPLETED');
    expect(store().pendingMove).toBe(false);
  });

  it('terminal snapshot always wins over in-progress and clears pending/offline flags', () => {
    store().applyGame(gameFixture({ moveCount: 4 }));
    store().setPending(true);
    store().setOpponentOffline({ userId: 'x', graceSeconds: 30, since: 1 });
    store().applyGame(gameFixture({ status: 'DRAW', moveCount: 4 }));
    expect(store().game?.status).toBe('DRAW');
    expect(store().pendingMove).toBe(false);
    expect(store().opponentOffline).toBeNull();
  });

  it('a different game resets per-game flags', () => {
    store().applyGame(gameFixture({ id: 'a', moveCount: 4 }));
    store().setRematch({ requestedByMe: true });
    store().applyGame(gameFixture({ id: 'b', moveCount: 0 }));
    expect(store().game?.id).toBe('b');
    expect(store().rematch.requestedByMe).toBe(false);
  });
});

describe('submitMove', () => {
  it('sends exactly one move while the first is still pending', async () => {
    store().applyGame(gameFixture());
    let resolve!: (v: unknown) => void;
    mockMove.mockImplementation(() => new Promise((r) => (resolve = r)));

    const first = submitMove(4);
    const second = submitMove(4);
    const third = submitMove(5);
    expect(mockMove).toHaveBeenCalledTimes(1);
    expect(store().pendingMove).toBe(true);

    resolve({ game: gameFixture({ moveCount: 1, board: ['', '', '', '', 'X', '', '', '', ''], currentTurn: 'O' }), move: { moveNumber: 1, position: 4, mark: 'X' }, duplicate: false });
    await Promise.all([first, second, third]);
    expect(mockMove).toHaveBeenCalledTimes(1);
    expect(store().pendingMove).toBe(false);
    expect(store().game?.board[4]).toBe('X');
    expect(mockMove).toHaveBeenCalledWith('game-1', 4, 'client-move-id-1', 1);
  });

  it('does nothing when the game is not in progress', async () => {
    store().applyGame(gameFixture({ status: 'COMPLETED' }));
    await submitMove(0);
    expect(mockMove).not.toHaveBeenCalled();
  });

  it('stores the server rejection and unlocks the board', async () => {
    store().applyGame(gameFixture());
    mockMove.mockRejectedValue({ code: 'CELL_OCCUPIED', message: 'taken' });
    await submitMove(0);
    expect(store().pendingMove).toBe(false);
    expect(store().moveError?.code).toBe('CELL_OCCUPIED');
  });
});

describe('finalized snapshot is never replaced by a stale terminal one', () => {
  it('keeps outcomes when a move ack (no outcomes) arrives after game:finished (with outcomes)', () => {
    const { useOnlineStore, hasOutcomes } = require('../../src/store/onlineStore');
    const base = { id: 'g-final', status: 'COMPLETED', moveCount: 5, players: [{ userId: 'a', mark: 'X', outcome: 'WIN', pointsAwarded: 25 }, { userId: 'b', mark: 'O', outcome: 'LOSS', pointsAwarded: 3 }] };
    useOnlineStore.getState().reset();
    useOnlineStore.getState().applyGame(base);
    useOnlineStore.getState().applyGame({ ...base, players: base.players.map((p) => ({ ...p, outcome: null, pointsAwarded: 0 })) });
    const g = useOnlineStore.getState().game;
    expect(hasOutcomes(g)).toBe(true);
    expect(g.players[0].pointsAwarded).toBe(25);
  });
});
