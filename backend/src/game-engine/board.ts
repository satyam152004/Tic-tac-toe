import { BoardConfig, BoardSize, Cell, Mark, MoveError, MoveRecord, Outcome } from './types.js';

export const SUPPORTED_SIZES: readonly BoardSize[] = [3, 4, 5];

/** Default win length per board size: 3x3 -> 3, 4x4 -> 4, 5x5 -> 4. */
export function defaultWinLength(size: BoardSize): number {
  return size === 5 ? 4 : size;
}

export function makeConfig(size: BoardSize, winLength?: number): BoardConfig {
  const cfg = { size, winLength: winLength ?? defaultWinLength(size) };
  assertValidConfig(cfg);
  return cfg;
}

export function assertValidConfig(cfg: BoardConfig): void {
  if (!SUPPORTED_SIZES.includes(cfg.size)) throw new RangeError(`Unsupported board size ${cfg.size}`);
  if (!Number.isInteger(cfg.winLength) || cfg.winLength < 3 || cfg.winLength > cfg.size) {
    throw new RangeError(`winLength must be an integer between 3 and ${cfg.size}`);
  }
}

export function createBoard(size: number): Cell[] {
  return new Array<Cell>(size * size).fill('');
}

export function otherMark(mark: Mark): Mark {
  return mark === 'X' ? 'O' : 'X';
}

const lineCache = new Map<string, number[][]>();

/** Every winning line (as cell indexes) for a board configuration. Cached. */
export function getWinLines(cfg: BoardConfig): number[][] {
  const key = `${cfg.size}:${cfg.winLength}`;
  const cached = lineCache.get(key);
  if (cached) return cached;
  const { size: n, winLength: k } = cfg;
  const lines: number[][] = [];
  const dirs: Array<[number, number]> = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diagonal \
    [1, -1], // diagonal /
  ];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      for (const [dr, dc] of dirs) {
        const endR = r + dr * (k - 1);
        const endC = c + dc * (k - 1);
        if (endR < 0 || endR >= n || endC < 0 || endC >= n) continue;
        const line: number[] = [];
        for (let i = 0; i < k; i++) line.push((r + dr * i) * n + (c + dc * i));
        lines.push(line);
      }
    }
  }
  lineCache.set(key, lines);
  return lines;
}

/** Winning line for `mark` anywhere on the board, or null. */
export function findWinningLine(board: readonly Cell[], cfg: BoardConfig, mark: Mark): number[] | null {
  for (const line of getWinLines(cfg)) {
    if (line.every((i) => board[i] === mark)) return line;
  }
  return null;
}

/** Evaluate a board: win (with line), draw, or in progress. */
export function evaluate(board: readonly Cell[], cfg: BoardConfig): Outcome {
  for (const mark of ['X', 'O'] as const) {
    const line = findWinningLine(board, cfg, mark);
    if (line) return { status: 'WIN', winner: mark, line };
  }
  if (board.every((c) => c !== '')) return { status: 'DRAW' };
  return { status: 'IN_PROGRESS' };
}

export function legalMoves(board: readonly Cell[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] === '') out.push(i);
  return out;
}

/** Throws MoveError when the move is not allowed on this board. */
export function assertLegalMove(board: readonly Cell[], position: number): void {
  if (!Number.isInteger(position) || position < 0 || position >= board.length) {
    throw new MoveError('CELL_OUT_OF_RANGE');
  }
  if (board[position] !== '') throw new MoveError('CELL_OCCUPIED');
}

/** Pure move application. Returns a new board and the resulting outcome. */
export function applyMove(
  board: readonly Cell[],
  cfg: BoardConfig,
  position: number,
  mark: Mark,
): { board: Cell[]; outcome: Outcome } {
  if (evaluate(board, cfg).status !== 'IN_PROGRESS') throw new MoveError('GAME_FINISHED');
  assertLegalMove(board, position);
  const next = board.slice() as Cell[];
  next[position] = mark;
  return { board: next, outcome: evaluate(next, cfg) };
}

/**
 * Replays a move list from an empty board, validating every move and the strict X,O,X,O
 * alternation (X always starts). Returns the final board/outcome or throws MoveError.
 * Used by the server to verify results of offline games uploaded by clients.
 */
export function replayMoves(
  cfg: BoardConfig,
  moves: ReadonlyArray<{ position: number }>,
): { board: Cell[]; outcome: Outcome; records: MoveRecord[] } {
  assertValidConfig(cfg);
  let board = createBoard(cfg.size);
  let outcome: Outcome = { status: 'IN_PROGRESS' };
  const records: MoveRecord[] = [];
  moves.forEach((m, idx) => {
    const mark: Mark = idx % 2 === 0 ? 'X' : 'O';
    const res = applyMove(board, cfg, m.position, mark);
    board = res.board;
    outcome = res.outcome;
    records.push({ moveNumber: idx + 1, position: m.position, mark });
  });
  return { board, outcome, records };
}

export function boardToString(board: readonly Cell[], size: number): string {
  const rows: string[] = [];
  for (let r = 0; r < size; r++) {
    rows.push(board.slice(r * size, r * size + size).map((c) => c || '.').join(' '));
  }
  return rows.join('\n');
}
