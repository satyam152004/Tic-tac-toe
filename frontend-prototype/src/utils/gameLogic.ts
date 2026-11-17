import { BoardSize, CellValue, Difficulty } from '../types/app';

export function getWinLength(size: BoardSize): number {
  if (size === 3) return 3;
  return 4; // 5x5 and 6x6 require 4 in a row
}

export function generateWinningLines(size: BoardSize): number[][] {
  const winLen = getWinLength(size);
  const lines: number[][] = [];

  // Rows
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - winLen; c++) {
      const line: number[] = [];
      for (let k = 0; k < winLen; k++) {
        line.push(r * size + (c + k));
      }
      lines.push(line);
    }
  }

  // Columns
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - winLen; r++) {
      const line: number[] = [];
      for (let k = 0; k < winLen; k++) {
        line.push((r + k) * size + c);
      }
      lines.push(line);
    }
  }

  // Diagonals (top-left to bottom-right)
  for (let r = 0; r <= size - winLen; r++) {
    for (let c = 0; c <= size - winLen; c++) {
      const line: number[] = [];
      for (let k = 0; k < winLen; k++) {
        line.push((r + k) * size + (c + k));
      }
      lines.push(line);
    }
  }

  // Anti-diagonals (top-right to bottom-left)
  for (let r = 0; r <= size - winLen; r++) {
    for (let c = winLen - 1; c < size; c++) {
      const line: number[] = [];
      for (let k = 0; k < winLen; k++) {
        line.push((r + k) * size + (c - k));
      }
      lines.push(line);
    }
  }

  return lines;
}

const WIN_LINES_CACHE: Record<number, number[][]> = {
  3: generateWinningLines(3),
  5: generateWinningLines(5),
  6: generateWinningLines(6),
};

export function checkWinner(
  board: CellValue[],
  size: BoardSize
): { winner: 'X' | 'O' | 'draw' | null; line: number[] | null } {
  const lines = WIN_LINES_CACHE[size] || generateWinningLines(size);

  for (const line of lines) {
    const first = board[line[0]];
    if (first && line.every((idx) => board[idx] === first)) {
      return { winner: first, line };
    }
  }

  if (board.every((cell) => cell !== null)) {
    return { winner: 'draw', line: null };
  }

  return { winner: null, line: null };
}

function minimax3x3(
  board: CellValue[],
  depth: number,
  isMaximizing: boolean,
  aiSymbol: 'X' | 'O',
  humanSymbol: 'X' | 'O'
): number {
  const res = checkWinner(board, 3);
  if (res.winner === aiSymbol) return 10 - depth;
  if (res.winner === humanSymbol) return depth - 10;
  if (res.winner === 'draw') return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiSymbol;
        best = Math.max(best, minimax3x3(board, depth + 1, false, aiSymbol, humanSymbol));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = humanSymbol;
        best = Math.min(best, minimax3x3(board, depth + 1, true, aiSymbol, humanSymbol));
        board[i] = null;
      }
    }
    return best;
  }
}

export function getAIMove(
  board: CellValue[],
  size: BoardSize,
  difficulty: Difficulty,
  aiSymbol: 'X' | 'O'
): number {
  const humanSymbol: 'X' | 'O' = aiSymbol === 'X' ? 'O' : 'X';
  const emptyIndices = board
    .map((val, idx) => (val === null ? idx : -1))
    .filter((idx) => idx !== -1);

  if (emptyIndices.length === 0) return -1;

  // Easy: mostly random, occasionally blocks immediate win
  if (difficulty === 'easy') {
    if (Math.random() < 0.25) {
      for (const idx of emptyIndices) {
        const copy = [...board];
        copy[idx] = aiSymbol;
        if (checkWinner(copy, size).winner === aiSymbol) return idx;
      }
    }
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  }

  // Medium: takes immediate wins and blocks immediate opponent wins, else center/heuristic
  if (difficulty === 'medium') {
    for (const idx of emptyIndices) {
      const copy = [...board];
      copy[idx] = aiSymbol;
      if (checkWinner(copy, size).winner === aiSymbol) return idx;
    }
    for (const idx of emptyIndices) {
      const copy = [...board];
      copy[idx] = humanSymbol;
      if (checkWinner(copy, size).winner === humanSymbol) return idx;
    }
    if (Math.random() < 0.65) {
      const center = Math.floor((size * size) / 2);
      if (board[center] === null) return center;
    }
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  }

  // Hard: optimal Minimax on 3x3, strong tactical scoring on 5x5 & 6x6
  if (size === 3) {
    let bestScore = -Infinity;
    let bestMove = emptyIndices[0];
    for (const idx of emptyIndices) {
      const copy = [...board];
      copy[idx] = aiSymbol;
      const score = minimax3x3(copy, 0, false, aiSymbol, humanSymbol);
      if (score > bestScore) {
        bestScore = score;
        bestMove = idx;
      }
    }
    return bestMove;
  }

  // 5x5 / 6x6 Hard heuristic: immediate win -> immediate block -> line potential score
  for (const idx of emptyIndices) {
    const copy = [...board];
    copy[idx] = aiSymbol;
    if (checkWinner(copy, size).winner === aiSymbol) return idx;
  }
  for (const idx of emptyIndices) {
    const copy = [...board];
    copy[idx] = humanSymbol;
    if (checkWinner(copy, size).winner === humanSymbol) return idx;
  }

  const lines = WIN_LINES_CACHE[size] || generateWinningLines(size);
  let bestIdx = emptyIndices[0];
  let bestWeight = -Infinity;

  for (const idx of emptyIndices) {
    let weight = 0;
    const row = Math.floor(idx / size);
    const col = idx % size;
    const centerDist = Math.abs(row - (size - 1) / 2) + Math.abs(col - (size - 1) / 2);
    weight += (size - centerDist) * 2;

    for (const line of lines) {
      if (!line.includes(idx)) continue;
      let aiCount = 0;
      let humanCount = 0;
      for (const cellIdx of line) {
        if (board[cellIdx] === aiSymbol) aiCount++;
        else if (board[cellIdx] === humanSymbol) humanCount++;
      }
      if (humanCount === 0) weight += Math.pow(4, aiCount + 1);
      if (aiCount === 0) weight += Math.pow(3.5, humanCount + 1);
    }

    if (weight > bestWeight) {
      bestWeight = weight;
      bestIdx = idx;
    }
  }

  return bestIdx;
}
