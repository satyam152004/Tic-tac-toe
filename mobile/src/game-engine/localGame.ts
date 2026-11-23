import { chooseMove, AiOptions } from './ai';
import { applyMove, createBoard, makeConfig, otherMark } from './board';
import { BoardConfig, BoardSize, Cell, Difficulty, Mark, MoveError, MoveRecord, Outcome } from './types';

/**
 * Offline game state machine used by the mobile app (no network or backend required).
 * All functions are pure: they take a state and return a new one, so it plugs straight into
 * React state / reducers and is trivially serialisable for offline match history.
 */
export interface LocalGameOptions {
  size?: BoardSize;
  winLength?: number;
  mode: 'LOCAL_2P' | 'VS_AI';
  difficulty?: Difficulty; // VS_AI only
  humanMark?: Mark; // VS_AI only (default X)
}

export interface LocalGameState {
  config: BoardConfig;
  mode: 'LOCAL_2P' | 'VS_AI';
  difficulty?: Difficulty;
  humanMark: Mark;
  board: Cell[];
  current: Mark;
  moves: MoveRecord[];
  outcome: Outcome;
  scores: { X: number; O: number; draws: number };
  /** Timer: accumulated ms while running + timestamp of last resume (null when paused/finished). */
  elapsedMs: number;
  resumedAt: number | null;
  startedAt: number;
}

export function newLocalGame(opts: LocalGameOptions, now: number = Date.now()): LocalGameState {
  const config = makeConfig(opts.size ?? 3, opts.winLength);
  return {
    config,
    mode: opts.mode,
    difficulty: opts.mode === 'VS_AI' ? (opts.difficulty ?? 'MEDIUM') : undefined,
    humanMark: opts.humanMark ?? 'X',
    board: createBoard(config.size),
    current: 'X',
    moves: [],
    outcome: { status: 'IN_PROGRESS' },
    scores: { X: 0, O: 0, draws: 0 },
    elapsedMs: 0,
    resumedAt: now,
    startedAt: now,
  };
}

export const aiMark = (s: LocalGameState): Mark => otherMark(s.humanMark);
export const isAiTurn = (s: LocalGameState): boolean =>
  s.mode === 'VS_AI' && s.outcome.status === 'IN_PROGRESS' && s.current === aiMark(s);

export function getElapsedMs(s: LocalGameState, now: number = Date.now()): number {
  return s.elapsedMs + (s.resumedAt === null ? 0 : now - s.resumedAt);
}

export function pauseTimer(s: LocalGameState, now: number = Date.now()): LocalGameState {
  if (s.resumedAt === null) return s;
  return { ...s, elapsedMs: getElapsedMs(s, now), resumedAt: null };
}

export function resumeTimer(s: LocalGameState, now: number = Date.now()): LocalGameState {
  if (s.resumedAt !== null || s.outcome.status !== 'IN_PROGRESS') return s;
  return { ...s, resumedAt: now };
}

/** Play a move for the current player. Throws MoveError for illegal moves. */
export function playMove(s: LocalGameState, position: number, now: number = Date.now()): LocalGameState {
  const { board, outcome } = applyMove(s.board, s.config, position, s.current);
  const move: MoveRecord = { moveNumber: s.moves.length + 1, position, mark: s.current };
  const finished = outcome.status !== 'IN_PROGRESS';
  const scores = { ...s.scores };
  if (outcome.status === 'WIN') scores[outcome.winner] += 1;
  if (outcome.status === 'DRAW') scores.draws += 1;
  const base: LocalGameState = {
    ...s,
    board,
    outcome,
    scores,
    moves: [...s.moves, move],
    current: finished ? s.current : otherMark(s.current),
  };
  return finished ? { ...base, elapsedMs: getElapsedMs(s, now), resumedAt: null } : base;
}

/** Let the AI play its move (no-op if it is not the AI's turn). */
export function playAiMove(s: LocalGameState, opts: AiOptions = {}, now: number = Date.now()): LocalGameState {
  if (!isAiTurn(s)) return s;
  const pos = chooseMove(s.board, s.config, s.current, s.difficulty ?? 'MEDIUM', opts);
  return playMove(s, pos, now);
}

/**
 * Undo (local mode only): removes the last move, or in VS_AI mode the last human+AI pair so the
 * human is on turn again. Un-does the score of a finished game.
 */
export function undo(s: LocalGameState, now: number = Date.now()): LocalGameState {
  if (s.moves.length === 0) return s;
  const toRemove = s.mode === 'VS_AI' ? (s.moves.length >= 2 && s.moves[s.moves.length - 1]!.mark === aiMark(s) ? 2 : 1) : 1;
  const scores = { ...s.scores };
  if (s.outcome.status === 'WIN') scores[s.outcome.winner] -= 1;
  if (s.outcome.status === 'DRAW') scores.draws -= 1;
  const moves = s.moves.slice(0, Math.max(0, s.moves.length - toRemove));
  const board = createBoard(s.config.size);
  for (const m of moves) board[m.position] = m.mark;
  const last = moves[moves.length - 1];
  return {
    ...s,
    board,
    moves,
    scores,
    outcome: { status: 'IN_PROGRESS' },
    current: last ? otherMark(last.mark) : 'X',
    resumedAt: now,
  };
}

/** Restart the board but keep the running scores (X always starts). */
export function restart(s: LocalGameState, now: number = Date.now()): LocalGameState {
  return {
    ...s,
    board: createBoard(s.config.size),
    moves: [],
    outcome: { status: 'IN_PROGRESS' },
    current: 'X',
    elapsedMs: 0,
    resumedAt: now,
    startedAt: now,
  };
}

/** Compact record suitable for storing in offline history / uploading for server verification. */
export interface LocalMatchRecord {
  config: BoardConfig;
  mode: 'LOCAL_2P' | 'VS_AI';
  difficulty?: Difficulty;
  humanMark: Mark;
  moves: number[]; // positions in order, X first
  result: 'X' | 'O' | 'DRAW';
  durationMs: number;
  playedAt: string; // ISO date
}

export function toMatchRecord(s: LocalGameState, now: number = Date.now()): LocalMatchRecord {
  if (s.outcome.status === 'IN_PROGRESS') throw new MoveError('GAME_FINISHED', 'This match isn\'t finished yet.');
  return {
    config: s.config,
    mode: s.mode,
    difficulty: s.difficulty,
    humanMark: s.humanMark,
    moves: s.moves.map((m) => m.position),
    result: s.outcome.status === 'WIN' ? s.outcome.winner : 'DRAW',
    durationMs: getElapsedMs(s, now),
    playedAt: new Date(now).toISOString(),
  };
}
