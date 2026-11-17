import { waitFor } from '@testing-library/react-native';
import { isAiTurn } from '../../src/game-engine';
import { localGameStorage } from '../../src/services/storage/localGameStorage';
import { DEFAULT_SETUP, useLocalGameStore } from '../../src/store/localGameStore';

const sqlite = jest.requireMock('expo-sqlite') as { __matches: unknown[] };
const st = () => useLocalGameStore.getState();

beforeEach(() => {
  sqlite.__matches.length = 0;
  useLocalGameStore.setState({ setup: DEFAULT_SETUP, game: null, paused: false, lastMatchId: null, historyVersion: 0, lastMove: null });
});

/** X wins the top row on 3x3 */
const playXWin = () => {
  [0, 3, 1, 4, 2].forEach((p) => expect(st().play(p)).toBe(true));
};

describe('localGameStore', () => {
  it('starts a game from the setup', () => {
    st().configure({ size: 4 });
    st().start();
    expect(st().game?.config.size).toBe(4);
    expect(st().game?.board).toHaveLength(16);
    expect(st().game?.moves).toHaveLength(0);
  });

  it('plays human turns, rejects occupied cells and supports undo', () => {
    st().start();
    expect(st().play(4)).toBe(true);
    expect(st().play(4)).toBe(false);
    expect(st().game?.current).toBe('O');
    expect(st().lastMove).toBe(4);
    st().undoMove();
    expect(st().game?.moves).toHaveLength(0);
    expect(st().game?.board[4]).toBe('');
  });

  it('VS_AI: human moves, the AI replies and blocks taps on its own turn', () => {
    st().configure({ mode: 'VS_AI', difficulty: 'EASY', p1Mark: 'X' });
    st().start();
    expect(st().play(0)).toBe(true);
    expect(isAiTurn(st().game!)).toBe(true);
    expect(st().play(8)).toBe(false);
    st().aiMove();
    expect(st().game?.moves).toHaveLength(2);
    expect(isAiTurn(st().game!)).toBe(false);
    // undo removes the human+AI pair
    st().undoMove();
    expect(st().game?.moves).toHaveLength(0);
  });

  it('VS_AI: AI moves first when the human picks O', () => {
    st().configure({ mode: 'VS_AI', difficulty: 'EASY', p1Mark: 'O' });
    st().start();
    expect(isAiTurn(st().game!)).toBe(true);
    st().aiMove();
    expect(st().game?.moves).toHaveLength(1);
  });

  it('a win stores the match exactly once', async () => {
    st().start();
    playXWin();
    expect(st().game?.outcome.status).toBe('WIN');
    await waitFor(() => expect(st().historyVersion).toBe(1));
    const matches = await localGameStorage.listMatches();
    expect(matches).toHaveLength(1);
    expect(matches[0]?.record.result).toBe('X');
    expect(matches[0]?.synced).toBe(false);
    expect(st().lastMatchId).toBe(matches[0]?.clientMatchId);
    // finished game accepts no more moves, so nothing is saved twice
    expect(st().play(5)).toBe(false);
    expect(await localGameStorage.listMatches()).toHaveLength(1);
  });

  it('rematch keeps scores and resets the board', async () => {
    st().start();
    playXWin();
    st().rematch();
    expect(st().game?.scores.X).toBe(1);
    expect(st().game?.moves).toHaveLength(0);
    expect(st().game?.outcome.status).toBe('IN_PROGRESS');
    expect(st().lastMatchId).toBeNull();
    await waitFor(() => expect(st().historyVersion).toBe(1));
  });

  it('pause blocks moves until unpause', () => {
    st().start();
    st().pause();
    expect(st().paused).toBe(true);
    expect(st().play(0)).toBe(false);
    st().unpause();
    expect(st().play(0)).toBe(true);
  });

  it('quit clears the active game', () => {
    st().start();
    st().play(0);
    st().quit();
    expect(st().game).toBeNull();
    expect(st().paused).toBe(false);
  });
});
