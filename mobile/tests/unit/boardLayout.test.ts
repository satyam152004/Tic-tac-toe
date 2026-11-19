import {
  CHROME, COMPACT_HEIGHT, LARGE_FONT_SCALE, MAX_BOARD, MIN_CELL, SCREEN_SPACE,
  boardMetrics, densityFor, estimateBoardArea, fitBoard, minBoardSide, stackControlsFor, BoardSize,
} from '../../src/components/game/boardLayout';

/** [name, window width, window height, top inset, bottom inset] in dp. */
const DEVICES = [
  ['iPhone SE (320x568)', 320, 568, 20, 0],
  ['Small Android (360x592)', 360, 592, 24, 0],
  ['Android (360x640)', 360, 640, 24, 0],
  ['Android gesture nav (360x780)', 360, 780, 28, 16],
  ['iPhone 14 (390x844)', 390, 844, 47, 34],
  ['Pixel 7 (412x915)', 412, 915, 32, 24],
  ['Tablet (768x1024)', 768, 1024, 24, 0],
] as const;
const SIZES: BoardSize[] = [3, 4, 5];
const FONT_SCALES = [1, 1.3, 1.5, 2];

const area = (d: (typeof DEVICES)[number], fontScale: number) =>
  estimateBoardArea({ windowWidth: d[1], windowHeight: d[2], insetTop: d[3], insetBottom: d[4], fontScale });

describe('boardMetrics / minBoardSide', () => {
  it('derives a whole-dp cell from the outer side', () => {
    expect(boardMetrics(3, 320)).toMatchObject({ gap: 10, pad: 14, cell: 90, corner: 16 });
    expect(boardMetrics(4, 320)).toMatchObject({ gap: 8, pad: 12, cell: 68, corner: 12 });
    expect(boardMetrics(5, 320)).toMatchObject({ gap: 6, pad: 10, cell: 55, corner: 12 });
    expect(boardMetrics(3, 320).glyph).toBe(Math.round(90 * 0.62));
  });
  it('compact (preview) boards use tighter gaps', () => {
    expect(boardMetrics(3, 96, true)).toMatchObject({ gap: 4, pad: 8 });
  });
  it('never returns a negative cell', () => {
    expect(boardMetrics(5, 10).cell).toBe(0);
  });
  it('minBoardSide is exactly the side at which cells are MIN_CELL', () => {
    for (const size of SIZES) {
      expect(boardMetrics(size, minBoardSide(size)).cell).toBe(MIN_CELL);
      expect(boardMetrics(size, minBoardSide(size) - size).cell).toBeLessThan(MIN_CELL);
    }
    expect([3, 4, 5].map((s) => minBoardSide(s as BoardSize))).toEqual([180, 224, 264]);
  });
});

describe('fitBoard', () => {
  it('takes the smaller of width, height and maxSize', () => {
    expect(fitBoard({ areaWidth: 300, areaHeight: 500, size: 3 })).toMatchObject({ side: 300, needsScroll: false });
    expect(fitBoard({ areaWidth: 500, areaHeight: 260, size: 3 })).toMatchObject({ side: 260, needsScroll: false });
    expect(fitBoard({ areaWidth: 700, areaHeight: 700, size: 3 }).side).toBe(MAX_BOARD);
    expect(fitBoard({ areaWidth: 700, areaHeight: 700, size: 3, maxSize: 260 }).side).toBe(260);
  });
  it('keeps the board at its minimum and asks for scrolling when the area is too short', () => {
    for (const size of SIZES) {
      const r = fitBoard({ areaWidth: 340, areaHeight: 100, size });
      expect(r).toMatchObject({ side: minBoardSide(size), minSide: minBoardSide(size), needsScroll: true });
      expect(boardMetrics(size, r.side).cell).toBeGreaterThanOrEqual(MIN_CELL);
    }
  });
  it('does not ask for scrolling exactly at the minimum', () => {
    expect(fitBoard({ areaWidth: 340, areaHeight: 180, size: 3 }).needsScroll).toBe(false);
    expect(fitBoard({ areaWidth: 340, areaHeight: 179, size: 3 }).needsScroll).toBe(true);
  });
  it('is never wider than the area, even if that goes below the minimum cell (cannot scroll sideways)', () => {
    expect(fitBoard({ areaWidth: 200, areaHeight: 600, size: 5 }).side).toBe(200);
  });
});

describe('density and large fonts', () => {
  it('goes compact on short screens and on large system fonts', () => {
    expect(densityFor(COMPACT_HEIGHT)).toBe('regular');
    expect(densityFor(COMPACT_HEIGHT - 1)).toBe('compact');
    expect(densityFor(900, LARGE_FONT_SCALE)).toBe('regular');
    expect(densityFor(900, LARGE_FONT_SCALE + 0.01)).toBe('compact');
  });
  it('stacks the controls only above the large-font threshold', () => {
    expect(stackControlsFor(1)).toBe(false);
    expect(stackControlsFor(LARGE_FONT_SCALE)).toBe(false);
    expect(stackControlsFor(1.5)).toBe(true);
  });
  it('compact density uses smaller spacing tokens', () => {
    expect(SCREEN_SPACE.compact.gutter).toBeLessThan(SCREEN_SPACE.regular.gutter);
    expect(SCREEN_SPACE.compact.gap).toBeLessThan(SCREEN_SPACE.regular.gap);
  });
});

describe('every device x grid x font scale', () => {
  it('REGRESSION: the old width-only sizing overflowed short screens; the new sizing fits them', () => {
    for (const d of DEVICES) {
      const legacySide = Math.min(d[1] - 40, 340);
      const fixedRegular = CHROME.header + d[3] + 20 * 2 + d[4] + CHROME.cards.regular + CHROME.status.regular + CHROME.control + 16 * 3;
      const legacyOverflow = fixedRegular + legacySide - d[2];
      const e = area(d, 1);
      const side = fitBoard({ areaWidth: e.width, areaHeight: e.height, size: 3 }).side;
      const fixedNow = d[2] - e.height;
      expect({ device: d[0], fits: fixedNow + side <= d[2] }).toEqual({ device: d[0], fits: true });
      if (d[0] === 'iPhone SE (320x568)' || d[0] === 'Small Android (360x592)') expect(legacyOverflow).toBeGreaterThan(0);
    }
  });

  it('at normal font size every grid fits every device without scrolling, with cells >= 44dp', () => {
    for (const d of DEVICES) for (const size of SIZES) {
      const e = area(d, 1);
      const r = fitBoard({ areaWidth: e.width, areaHeight: e.height, size });
      expect({ d: d[0], size, scroll: r.needsScroll }).toEqual({ d: d[0], size, scroll: false });
      expect(boardMetrics(size, r.side).cell).toBeGreaterThanOrEqual(MIN_CELL);
    }
  });

  it('the board never exceeds the area width or MAX_BOARD, and leaves no chrome off-screen when it does not scroll', () => {
    for (const d of DEVICES) for (const fs of FONT_SCALES) for (const size of SIZES) {
      const e = area(d, fs);
      const r = fitBoard({ areaWidth: e.width, areaHeight: e.height, size });
      expect(r.side).toBeLessThanOrEqual(e.width);
      expect(r.side).toBeLessThanOrEqual(MAX_BOARD);
      if (!r.needsScroll) {
        expect(r.side).toBeLessThanOrEqual(e.height);
        expect(boardMetrics(size, r.side).cell).toBeGreaterThanOrEqual(MIN_CELL);
      }
    }
  });

  it('REPORT: exactly these layouts scroll (all at large font scales on short phones)', () => {
    const scrolling: string[] = [];
    for (const d of DEVICES) for (const fs of FONT_SCALES) for (const size of SIZES) {
      const e = area(d, fs);
      if (fitBoard({ areaWidth: e.width, areaHeight: e.height, size }).needsScroll) scrolling.push(`${d[0]} | font ${fs} | ${size}x${size}`);
    }
    expect(scrolling).toEqual([
      'iPhone SE (320x568) | font 1.5 | 4x4',
      'iPhone SE (320x568) | font 1.5 | 5x5',
      'iPhone SE (320x568) | font 2 | 4x4',
      'iPhone SE (320x568) | font 2 | 5x5',
      'Small Android (360x592) | font 1.5 | 4x4',
      'Small Android (360x592) | font 1.5 | 5x5',
      'Small Android (360x592) | font 2 | 4x4',
      'Small Android (360x592) | font 2 | 5x5',
      'Android (360x640) | font 1.5 | 5x5',
      'Android (360x640) | font 2 | 5x5',
    ]);
  });
});
