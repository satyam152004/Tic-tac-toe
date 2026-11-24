import {
  BASE_WIDTH,
  FONT_MAX_FACTOR,
  FONT_MIN_FACTOR,
  MAX_FACTOR,
  MAX_FONT_SIZE_MULTIPLIER,
  MIN_FACTOR,
  MIN_FONT,
  ch,
  factorFor,
  fontFactorFor,
  fs,
  liftControl,
  liftFont,
  ms,
} from '../src/design-system/responsive';

describe('responsive scale', () => {
  it('clamps the factor so small phones shrink a little and tablets never blow up', () => {
    expect(factorFor(BASE_WIDTH)).toBe(1);
    expect(factorFor(320)).toBe(MIN_FACTOR);
    expect(factorFor(360)).toBeCloseTo(360 / BASE_WIDTH, 5);
    expect(factorFor(768)).toBe(MAX_FACTOR);
  });

  it('keeps type nearly constant across phone widths (OS font scale does the rest)', () => {
    expect(fontFactorFor(BASE_WIDTH)).toBe(1);
    expect(fontFactorFor(320)).toBe(FONT_MIN_FACTOR);
    expect(fontFactorFor(768)).toBe(FONT_MAX_FACTOR);
    expect(FONT_MAX_FACTOR).toBeLessThan(MAX_FACTOR);
  });

  it('never lets text drop below 11 and keeps the size order (monotonic)', () => {
    const sizes = [8, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 17, 19, 20, 24, 28];
    let prev = 0;
    for (const n of sizes) {
      const v = liftFont(n);
      expect(v).toBeGreaterThanOrEqual(MIN_FONT);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(liftFont(10)).toBe(11);
    expect(liftFont(12)).toBe(12);
    expect(liftFont(13)).toBe(13);
    expect(liftFont(28)).toBe(28);
  });

  it('lifts kit control heights to comfortable touch sizes', () => {
    expect(liftControl(41)).toBeCloseTo(47.97, 1);
    expect(liftControl(36)).toBeCloseTo(42.12, 1);
    expect(liftControl(34)).toBe(40);
    expect(liftControl(28)).toBe(35);
  });

  it('exposes scaled helpers that return finite numbers', () => {
    for (const f of [fs(10), ms(16), ch(41)]) expect(Number.isFinite(f)).toBe(true);
    expect(fs(10)).toBeGreaterThanOrEqual(MIN_FONT);
  });

  it('lets the system Large/Small text setting apply up to 2×', () => {
    expect(MAX_FONT_SIZE_MULTIPLIER).toBe(2);
  });
});
