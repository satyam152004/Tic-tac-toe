import { Dimensions } from 'react-native';

/**
 * Responsive sizing. The UI kit was drawn at web-mock sizes (10-12 px text, 36-41 px controls) on a 390 pt wide
 * frame; on a real phone that reads far too small. Everything that was copied from the kit goes through these helpers:
 *
 *   fs(n)  text size    lifts the kit's tiny sizes to readable ones (never below 12), then scales with the screen
 *   ms(n)  layout size  plain scaling with the screen width (icons, avatars, paddings, gaps)
 *   ch(n)  control      button / input / row heights: lifted to comfortable touch sizes, then scaled
 *
 * The scale follows the SHORT side of the window (the app is portrait only) relative to a 390 pt phone and is clamped,
 * so small phones (320-360) shrink a little and large phones / tablets never blow up.
 */
export const BASE_WIDTH = 390;
export const MIN_FACTOR = 0.9;
export const MAX_FACTOR = 1.2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Scale factor for a given window width (exported for tests). */
export const factorFor = (width: number): number => clamp(width / BASE_WIDTH, MIN_FACTOR, MAX_FACTOR);

const win = Dimensions.get('window');
export const scaleFactor = factorFor(Math.min(win.width, win.height));

/** Kit text size -> readable size before screen scaling (exported for tests). */
export const liftFont = (n: number): number => {
  const bump = n <= 13 ? 2 : Math.max(0, 2 - (n - 13) * 0.4);
  return Math.max(12, n + bump);
};

export const fs = (n: number): number => round1(liftFont(n) * scaleFactor);

/** Plain proportional scaling (design tokens that were already phone-sized, icons, avatars, spacing). */
export const ms = (n: number): number => round1(n * scaleFactor);

/** Control height lift: 41 -> 48, 40 -> 47, 36 -> 42, 28 -> 35 (before screen scaling). */
export const liftControl = (n: number): number => (n < 30 ? n * 1.25 : Math.max(40, n * 1.17));
export const ch = (n: number): number => Math.round(liftControl(n) * scaleFactor);

/** Comfortable touch target (pt). */
export const MIN_TOUCH = 44;
