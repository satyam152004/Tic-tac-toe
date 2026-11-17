/**
 * Shared game-engine types. This folder has NO Node/Mongo dependencies so it can be copied
 * (or published) and imported unchanged by the React Native app for offline play.
 */
export type Mark = 'X' | 'O';
export type Cell = Mark | '';
export type BoardSize = 3 | 4 | 5;
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT' | 'IMPOSSIBLE';

export interface BoardConfig {
  size: BoardSize;
  /** Marks in a row needed to win (3..size). */
  winLength: number;
}

export type Outcome =
  | { status: 'IN_PROGRESS' }
  | { status: 'WIN'; winner: Mark; line: number[] }
  | { status: 'DRAW' };

export interface MoveRecord {
  moveNumber: number; // 1-based
  position: number; // 0..size*size-1, row-major
  mark: Mark;
}

export type MoveErrorCode = 'CELL_OUT_OF_RANGE' | 'CELL_OCCUPIED' | 'GAME_FINISHED';

export class MoveError extends Error {
  constructor(
    public readonly code: MoveErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'MoveError';
  }
}
