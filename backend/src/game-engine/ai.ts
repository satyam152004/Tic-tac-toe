import { getWinLines, legalMoves } from './board.js';
import { BoardConfig, Cell, Difficulty, Mark } from './types.js';

export interface AiOptions {
  /** Injectable RNG (0..1) for deterministic tests. */
  rng?: () => number;
  /** Override the time budget (ms) for search based difficulties. */
  timeBudgetMs?: number;
}

const WIN_SCORE = 1_000_000;

interface Ctx {
  n: number;
  size: number;
  lines: number[][];
  cellLines: number[][][]; // lines passing through each cell
  b: Int8Array; // 0 empty, 1 X, 2 O
  deadline: number;
  nodes: number;
  aborted: boolean;
  radiusOnly: boolean;
}

const ctxCache = new Map<string, { lines: number[][]; cellLines: number[][][] }>();

function topology(cfg: BoardConfig) {
  const key = `${cfg.size}:${cfg.winLength}`;
  let t = ctxCache.get(key);
  if (!t) {
    const lines = getWinLines(cfg);
    const cellLines: number[][][] = Array.from({ length: cfg.size * cfg.size }, () => []);
    for (const line of lines) for (const c of line) cellLines[c]!.push(line);
    t = { lines, cellLines };
    ctxCache.set(key, t);
  }
  return t;
}

const toInt = (c: Cell): number => (c === 'X' ? 1 : c === 'O' ? 2 : 0);

function makeCtx(board: readonly Cell[], cfg: BoardConfig, deadline: number): Ctx {
  const t = topology(cfg);
  const b = Int8Array.from(board.map(toInt));
  return {
    n: cfg.size,
    size: cfg.size * cfg.size,
    lines: t.lines,
    cellLines: t.cellLines,
    b,
    deadline,
    nodes: 0,
    aborted: false,
    radiusOnly: cfg.size >= 5,
  };
}

/** Does placing `p` (already set on the board) complete a line for `p`'s owner? */
function winsAt(ctx: Ctx, cell: number): boolean {
  const who = ctx.b[cell]!;
  for (const line of ctx.cellLines[cell]!) {
    let all = true;
    for (let i = 0; i < line.length; i++) {
      if (ctx.b[line[i]!] !== who) {
        all = false;
        break;
      }
    }
    if (all) return true;
  }
  return false;
}

function wouldWin(ctx: Ctx, cell: number, who: number): boolean {
  ctx.b[cell] = who;
  const w = winsAt(ctx, cell);
  ctx.b[cell] = 0;
  return w;
}

const LINE_WEIGHT = [0, 1, 10, 100, 1000, 10000];

/** Static evaluation from the perspective of `me` (positive = good for `me`). */
function heuristic(ctx: Ctx, me: number): number {
  const opp = me === 1 ? 2 : 1;
  let score = 0;
  for (const line of ctx.lines) {
    let mine = 0;
    let theirs = 0;
    for (let i = 0; i < line.length; i++) {
      const v = ctx.b[line[i]!];
      if (v === me) mine++;
      else if (v === opp) theirs++;
    }
    if (mine > 0 && theirs === 0) score += LINE_WEIGHT[Math.min(mine, 5)]!;
    else if (theirs > 0 && mine === 0) score -= LINE_WEIGHT[Math.min(theirs, 5)]!;
  }
  return score;
}

function candidateMoves(ctx: Ctx): number[] {
  const n = ctx.n;
  const empty: number[] = [];
  let occupied = 0;
  for (let i = 0; i < ctx.size; i++) {
    if (ctx.b[i] === 0) empty.push(i);
    else occupied++;
  }
  if (occupied === 0) return [Math.floor(ctx.size / 2)];
  let cands = empty;
  if (ctx.radiusOnly) {
    const near = empty.filter((i) => {
      const r = Math.floor(i / n);
      const c = i % n;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
          if (ctx.b[rr * n + cc] !== 0) return true;
        }
      }
      return false;
    });
    if (near.length > 0) cands = near;
  }
  // Order: closer to the centre first (cheap, effective ordering).
  const mid = (n - 1) / 2;
  return cands.sort((a, c) => {
    const da = Math.abs(Math.floor(a / n) - mid) + Math.abs((a % n) - mid);
    const dc = Math.abs(Math.floor(c / n) - mid) + Math.abs((c % n) - mid);
    return da - dc;
  });
}

/** Negamax with alpha-beta pruning. Score is from the viewpoint of `who` (the side to move). */
function negamax(ctx: Ctx, depth: number, alpha: number, beta: number, who: number, ply: number): number {
  if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.aborted = true;
  if (ctx.aborted) return 0;
  const moves = candidateMoves(ctx);
  if (moves.length === 0) return 0; // draw
  if (depth === 0) return heuristic(ctx, who);
  const opp = who === 1 ? 2 : 1;
  let best = -Infinity;
  for (const m of moves) {
    ctx.b[m] = who;
    let score: number;
    if (winsAt(ctx, m)) score = WIN_SCORE - ply;
    else score = -negamax(ctx, depth - 1, -beta, -alpha, opp, ply + 1);
    ctx.b[m] = 0;
    if (ctx.aborted) return 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Search every root move at a fixed depth; returns scored moves (or null when aborted). */
function searchRoot(ctx: Ctx, who: number, depth: number, order: number[]): Array<{ move: number; score: number }> | null {
  const opp = who === 1 ? 2 : 1;
  const results: Array<{ move: number; score: number }> = [];
  let alpha = -Infinity;
  for (const m of order) {
    ctx.b[m] = who;
    let score: number;
    if (winsAt(ctx, m)) score = WIN_SCORE;
    else score = -negamax(ctx, depth - 1, -Infinity, Infinity, opp, 1);
    ctx.b[m] = 0;
    if (ctx.aborted) return null;
    results.push({ move: m, score });
    if (score > alpha) alpha = score;
  }
  return results;
}

function pickBest(
  scored: Array<{ move: number; score: number }>,
  rng: () => number,
): number {
  const top = Math.max(...scored.map((s) => s.score));
  const best = scored.filter((s) => s.score === top);
  return best[Math.floor(rng() * best.length)]!.move;
}

function iterativeDeepening(
  board: readonly Cell[],
  cfg: BoardConfig,
  me: Mark,
  maxDepth: number,
  budgetMs: number,
  rng: () => number,
): number {
  const ctx = makeCtx(board, cfg, Date.now() + budgetMs);
  const who = me === 'X' ? 1 : 2;
  const rootMoves = candidateMoves(ctx);
  let order = rootMoves;
  let best = rootMoves[0]!;
  const empties = legalMoves(board).length;
  for (let depth = 1; depth <= Math.min(maxDepth, empties); depth++) {
    const scored = searchRoot(ctx, who, depth, order);
    if (!scored) break; // out of time: keep last completed depth
    best = pickBest(scored, rng);
    order = scored.slice().sort((a, b) => b.score - a.score).map((s) => s.move);
    if (scored.some((s) => s.score >= WIN_SCORE - 100)) break; // forced win found
  }
  return best;
}

function findImmediate(board: readonly Cell[], cfg: BoardConfig, mark: Mark): number | null {
  const ctx = makeCtx(board, cfg, Infinity);
  const me = mark === 'X' ? 1 : 2;
  const opp = me === 1 ? 2 : 1;
  const moves = legalMoves(board);
  for (const m of moves) if (wouldWin(ctx, m, me)) return m;
  for (const m of moves) if (wouldWin(ctx, m, opp)) return m;
  return null;
}

/**
 * Choose a move for `mark`. Always returns a legal (empty) cell; throws only if the board is full.
 *  - EASY:       random legal move
 *  - MEDIUM:     win > block > centre/random
 *  - HARD:       win > block > depth-2 alpha-beta with heuristic evaluation
 *  - EXPERT:     iterative-deepening alpha-beta (depth <= 6, 250ms budget; solves 3x3)
 *  - IMPOSSIBLE: 3x3 -> full-depth alpha-beta (unbeatable); 4x4/5x5 -> deeper iterative
 *                deepening alpha-beta with candidate pruning and a larger time budget
 */
export function chooseMove(
  board: readonly Cell[],
  cfg: BoardConfig,
  mark: Mark,
  difficulty: Difficulty,
  opts: AiOptions = {},
): number {
  const rng = opts.rng ?? Math.random;
  const legal = legalMoves(board);
  if (legal.length === 0) throw new RangeError('No legal moves available');
  const randomLegal = () => legal[Math.floor(rng() * legal.length)]!;

  let move: number | null = null;
  switch (difficulty) {
    case 'EASY':
      move = randomLegal();
      break;
    case 'MEDIUM': {
      move = findImmediate(board, cfg, mark);
      if (move === null) {
        const centre = Math.floor((cfg.size * cfg.size) / 2);
        move = board[centre] === '' && cfg.size % 2 === 1 && rng() < 0.7 ? centre : randomLegal();
      }
      break;
    }
    case 'HARD': {
      move = findImmediate(board, cfg, mark);
      if (move === null) move = iterativeDeepening(board, cfg, mark, 2, opts.timeBudgetMs ?? 100, rng);
      break;
    }
    case 'EXPERT': {
      move = iterativeDeepening(board, cfg, mark, 6, opts.timeBudgetMs ?? 250, rng);
      break;
    }
    case 'IMPOSSIBLE': {
      const solvable = cfg.size === 3;
      move = iterativeDeepening(
        board,
        cfg,
        mark,
        solvable ? 9 : 12,
        opts.timeBudgetMs ?? (solvable ? 5000 : 700),
        rng,
      );
      break;
    }
  }
  // Safety net: the AI must never return an invalid move.
  if (move === null || board[move] !== '' || move < 0 || move >= board.length) move = randomLegal();
  return move;
}
