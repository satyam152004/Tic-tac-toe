import { describe, expect, it } from 'vitest';
import {
  applyMove,
  chooseMove,
  createBoard,
  evaluate,
  getWinLines,
  legalMoves,
  makeConfig,
  MoveError,
  newLocalGame,
  playAiMove,
  playMove,
  replayMoves,
  restart,
  undo,
  toMatchRecord,
  Cell,
  Difficulty,
  Mark,
  BoardConfig,
} from '../../src/game-engine/index.js';

const cfg3 = makeConfig(3);

function boardFrom(rows: string[]): Cell[] {
  return rows.join('').split('').map((c) => (c === '.' ? '' : (c as Mark)));
}

describe('win detection', () => {
  it('detects horizontal wins', () => {
    const out = evaluate(boardFrom(['XXX', 'OO.', '...']), cfg3);
    expect(out).toEqual({ status: 'WIN', winner: 'X', line: [0, 1, 2] });
  });
  it('detects vertical wins', () => {
    const out = evaluate(boardFrom(['XO.', 'XO.', '.OX']), cfg3);
    expect(out).toMatchObject({ status: 'WIN', winner: 'O', line: [1, 4, 7] });
  });
  it('detects both diagonals', () => {
    expect(evaluate(boardFrom(['XO.', 'OX.', '..X']), cfg3)).toMatchObject({ winner: 'X', line: [0, 4, 8] });
    expect(evaluate(boardFrom(['X.O', 'XO.', 'O.X']), cfg3)).toMatchObject({ winner: 'O', line: [2, 4, 6] });
  });
  it('detects a draw', () => {
    expect(evaluate(boardFrom(['XOX', 'XOO', 'OXX']), cfg3)).toEqual({ status: 'DRAW' });
  });
  it('is in progress otherwise', () => {
    expect(evaluate(boardFrom(['X..', '.O.', '...']), cfg3)).toEqual({ status: 'IN_PROGRESS' });
  });
  it('supports configurable win length on larger boards', () => {
    const cfg = makeConfig(5, 4);
    const b = createBoard(5);
    [0, 6, 12, 18].forEach((i) => (b[i] = 'X'));
    expect(evaluate(b, cfg).status).toBe('WIN');
    expect(evaluate(b, makeConfig(5, 5)).status).toBe('IN_PROGRESS');
  });
  it('4x4 default needs 4 in a row', () => {
    const cfg = makeConfig(4);
    expect(cfg.winLength).toBe(4);
    const b = createBoard(4);
    [0, 1, 2].forEach((i) => (b[i] = 'X'));
    expect(evaluate(b, cfg).status).toBe('IN_PROGRESS');
    b[3] = 'X';
    expect(evaluate(b, cfg).status).toBe('WIN');
  });
  it('generates the expected number of lines', () => {
    expect(getWinLines(cfg3)).toHaveLength(8);
    expect(getWinLines(makeConfig(4, 4))).toHaveLength(10);
  });
  it('rejects invalid configs', () => {
    expect(() => makeConfig(5, 6)).toThrow();
    expect(() => makeConfig(3, 2)).toThrow();
    expect(() => makeConfig(7 as never)).toThrow();
  });
});

describe('moves', () => {
  it('rejects occupied, out-of-range and post-game moves', () => {
    const b = boardFrom(['X..', '...', '...']);
    expect(() => applyMove(b, cfg3, 0, 'O')).toThrow(MoveError);
    expect(() => applyMove(b, cfg3, 9, 'O')).toThrow(MoveError);
    expect(() => applyMove(b, cfg3, -1, 'O')).toThrow(MoveError);
    expect(() => applyMove(b, cfg3, 1.5, 'O')).toThrow(MoveError);
    const won = boardFrom(['XXX', 'OO.', '...']);
    expect(() => applyMove(won, cfg3, 8, 'O')).toThrowError(/GAME_FINISHED/);
  });
  it('replays a move list and rejects illegal ones', () => {
    const res = replayMoves(cfg3, [{ position: 0 }, { position: 3 }, { position: 1 }, { position: 4 }, { position: 2 }]);
    expect(res.outcome).toMatchObject({ status: 'WIN', winner: 'X' });
    expect(() => replayMoves(cfg3, [{ position: 0 }, { position: 0 }])).toThrow(MoveError);
    expect(() => replayMoves(cfg3, [{ position: 0 }, { position: 3 }, { position: 1 }, { position: 4 }, { position: 2 }, { position: 8 }])).toThrow(MoveError);
  });
});

describe('AI', () => {
  const difficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD', 'EXPERT', 'IMPOSSIBLE'];
  const sizes: BoardConfig[] = [makeConfig(3), makeConfig(4), makeConfig(5, 4), makeConfig(5, 5)];

  it('never makes an invalid move in full games (all difficulties, all sizes)', () => {
    for (const cfg of sizes) {
      for (const d of difficulties) {
        let board = createBoard(cfg.size);
        let mark: Mark = 'X';
        for (let guard = 0; guard < cfg.size * cfg.size; guard++) {
          if (evaluate(board, cfg).status !== 'IN_PROGRESS') break;
          const diff: Difficulty = mark === 'X' ? d : 'EASY';
          const pos = chooseMove(board, cfg, mark, diff, { timeBudgetMs: 30 });
          expect(legalMoves(board)).toContain(pos);
          board = applyMove(board, cfg, pos, mark).board;
          mark = mark === 'X' ? 'O' : 'X';
        }
      }
    }
  });

  it('medium takes a winning move and blocks', () => {
    expect(chooseMove(boardFrom(['XX.', 'OO.', '...']), cfg3, 'X', 'MEDIUM')).toBe(2);
    expect(chooseMove(boardFrom(['XX.', '.O.', '...']), cfg3, 'O', 'MEDIUM')).toBe(2);
  });

  it('hard and expert win/block immediately', () => {
    for (const d of ['HARD', 'EXPERT', 'IMPOSSIBLE'] as Difficulty[]) {
      expect(chooseMove(boardFrom(['XX.', 'OO.', '..X']), cfg3, 'O', d)).toBe(5);
      expect(chooseMove(boardFrom(['XX.', '.O.', '...']), cfg3, 'O', d)).toBe(2);
    }
  });

  it('IMPOSSIBLE never loses on 3x3 against random play (both sides)', () => {
    let seed = 42;
    const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    for (let game = 0; game < 40; game++) {
      const ai: Mark = game % 2 === 0 ? 'X' : 'O';
      let board = createBoard(3);
      let mark: Mark = 'X';
      while (evaluate(board, cfg3).status === 'IN_PROGRESS') {
        const pos = mark === ai ? chooseMove(board, cfg3, mark, 'IMPOSSIBLE', { rng }) : chooseMove(board, cfg3, mark, 'EASY', { rng });
        board = applyMove(board, cfg3, pos, mark).board;
        mark = mark === 'X' ? 'O' : 'X';
      }
      const out = evaluate(board, cfg3);
      if (out.status === 'WIN') expect(out.winner).toBe(ai);
    }
  });

  it('IMPOSSIBLE vs IMPOSSIBLE on 3x3 is always a draw', () => {
    let board = createBoard(3);
    let mark: Mark = 'X';
    while (evaluate(board, cfg3).status === 'IN_PROGRESS') {
      board = applyMove(board, cfg3, chooseMove(board, cfg3, mark, 'IMPOSSIBLE'), mark).board;
      mark = mark === 'X' ? 'O' : 'X';
    }
    expect(evaluate(board, cfg3).status).toBe('DRAW');
  });

  it('throws on a full board', () => {
    expect(() => chooseMove(boardFrom(['XOX', 'XOO', 'OXX']), cfg3, 'X', 'EASY')).toThrow();
  });
});

describe('local (offline) game', () => {
  it('supports play, undo, restart and score tracking', () => {
    let s = newLocalGame({ mode: 'LOCAL_2P' }, 1000);
    for (const p of [0, 3, 1, 4, 2]) s = playMove(s, p, 2000);
    expect(s.outcome).toMatchObject({ status: 'WIN', winner: 'X' });
    expect(s.scores.X).toBe(1);
    expect(s.elapsedMs).toBe(1000);
    s = undo(s, 3000);
    expect(s.scores.X).toBe(0);
    expect(s.outcome.status).toBe('IN_PROGRESS');
    expect(s.current).toBe('X');
    s = playMove(s, 2, 3000);
    expect(toMatchRecord(s, 4000).result).toBe('X');
    s = restart(s, 5000);
    expect(s.moves).toHaveLength(0);
    expect(s.scores.X).toBe(1);
  });
  it('undo in vs-AI mode removes the human+AI pair', () => {
    let s = newLocalGame({ mode: 'VS_AI', difficulty: 'EASY' });
    s = playMove(s, 0);
    s = playAiMove(s);
    expect(s.moves).toHaveLength(2);
    s = undo(s);
    expect(s.moves).toHaveLength(0);
    expect(s.current).toBe('X');
  });
  it('rejects illegal local moves', () => {
    let s = newLocalGame({ mode: 'LOCAL_2P' });
    s = playMove(s, 4);
    expect(() => playMove(s, 4)).toThrow(MoveError);
  });
});
