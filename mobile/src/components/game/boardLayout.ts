/**
 * Pure board / game-screen sizing. No React, no native modules: everything here is unit-tested across device sizes
 * (tests/unit/boardLayout.test.ts), including which layouts have to scroll.
 *
 * The board is sized from the space that is actually left on the screen, not from the window width:
 *   side = min(areaWidth, maxSize, max(areaHeight, minSide))
 * If the area is shorter than `minSide` (the size at which every cell is still a 44dp touch target) the board keeps
 * `minSide` and the screen scrolls, so no control is ever clipped or pushed out of reach.
 */

import { space } from '../../design-system/spacing';

export type BoardSize = 3 | 4 | 5;

/** Smallest comfortable touch target for a cell (dp). */
export const MIN_CELL = 44;
/** Largest board on screen (dp); bigger screens centre it. */
export const MAX_BOARD = 340;

/** Gap between cells and board padding per grid size (dp). `compact` is the small static preview board. */
const GAP: Record<BoardSize, number> = { 3: 10, 4: 8, 5: 6 };
const PAD: Record<BoardSize, number> = { 3: 14, 4: 12, 5: 10 };
const COMPACT_GAP = 4;
const COMPACT_PAD = 8;

export interface BoardMetrics {
  gap: number;
  pad: number;
  cell: number;
  glyph: number;
  corner: number;
}

/** Cell size etc. for a board whose outer side is `outer`. */
export function boardMetrics(size: BoardSize, outer: number, compact = false): BoardMetrics {
  const gap = compact ? COMPACT_GAP : GAP[size];
  const pad = compact ? COMPACT_PAD : PAD[size];
  const cell = Math.max(0, Math.floor((outer - pad * 2 - gap * (size - 1)) / size));
  return { gap, pad, cell, glyph: Math.round(cell * 0.62), corner: size === 3 ? 16 : 12 };
}

/** Outer side at which every cell is exactly `MIN_CELL`. */
export function minBoardSide(size: BoardSize, compact = false): number {
  const { gap, pad } = boardMetrics(size, 0, compact);
  return size * MIN_CELL + gap * (size - 1) + pad * 2;
}

export interface FitResult {
  /** Outer side of the board (dp). */
  side: number;
  /** Smallest side at which cells stay `MIN_CELL`; the board area must be at least this tall. */
  minSide: number;
  /** The area is shorter than `minSide`: the screen scrolls instead of shrinking the cells further. */
  needsScroll: boolean;
}

export function fitBoard(opts: { areaWidth: number; areaHeight: number; size: BoardSize; maxSize?: number }): FitResult {
  const { areaWidth, areaHeight, size, maxSize = MAX_BOARD } = opts;
  const minSide = minBoardSide(size);
  const side = Math.floor(Math.min(areaWidth, maxSize, Math.max(areaHeight, minSide)));
  return { side: Math.max(0, side), minSide, needsScroll: areaHeight < minSide };
}

/* ------------------------------ density ------------------------------ */

export type Density = 'regular' | 'compact';

/** Window height (dp) below which the game screen switches to its compact density. */
export const COMPACT_HEIGHT = 700;
/** System font scale above which labels get more room (controls stack, density goes compact). */
export const LARGE_FONT_SCALE = 1.3;

export function densityFor(windowHeight: number, fontScale = 1): Density {
  return windowHeight < COMPACT_HEIGHT || fontScale > LARGE_FONT_SCALE ? 'compact' : 'regular';
}

export const stackControlsFor = (fontScale = 1): boolean => fontScale > LARGE_FONT_SCALE;

/* --------------------- first-frame estimate of the board area --------------------- */

/**
 * Heights of the fixed parts of the board screen (dp, at font scale 1). Used only to size the board for the very first
 * frame and in tests; once laid out, the board uses the measured area (BoardArea), which also accounts for large fonts.
 */
export const CHROME = {
  header: 60, // AppHeader below the status bar inset
  cards: { regular: 58, compact: 54 },
  status: { regular: 38, compact: 30 },
  control: 56, // one control tile (icon over label)
  controlRow: 48, // one control when stacked as a row
  controlGap: 8,
} as const;

export const SCREEN_SPACE = {
  regular: { gutter: space.xl, gap: space.lg },
  compact: { gutter: space.md, gap: space.md },
} as const;

export function estimateBoardArea(opts: {
  windowWidth: number;
  windowHeight: number;
  insetTop?: number;
  insetBottom?: number;
  fontScale?: number;
}): { width: number; height: number; density: Density; stackedControls: boolean } {
  const { windowWidth, windowHeight, insetTop = 0, insetBottom = 0, fontScale = 1 } = opts;
  const density = densityFor(windowHeight, fontScale);
  const stackedControls = stackControlsFor(fontScale);
  const { gutter, gap } = SCREEN_SPACE[density];
  const controls = stackedControls ? 3 * CHROME.controlRow + 2 * CHROME.controlGap : CHROME.control;
  const fixed =
    CHROME.header + insetTop + gutter * 2 + insetBottom + CHROME.cards[density] + CHROME.status[density] + controls + gap * 3;
  return { width: windowWidth - gutter * 2, height: windowHeight - fixed, density, stackedControls };
}
