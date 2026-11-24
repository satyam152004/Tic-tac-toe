import { Dimensions } from 'react-native';

export const BASE_WIDTH = 390;
export const MIN_FACTOR = 0.9;
export const MAX_FACTOR = 1.2;

/** Type barely follows screen width; the OS font-size setting does the real scaling. */
export const FONT_MIN_FACTOR = 0.95;
export const FONT_MAX_FACTOR = 1.05;
export const MIN_FONT = 11;

/**
 * How far text may grow with the phone's Large Text setting.
 * 2× covers iOS XXXL / Android largest, while layouts that already react to `fontScale` stay intact.
 */
export const MAX_FONT_SIZE_MULTIPLIER = 2;
/** Tab labels, nav titles, and single-line buttons — grow, but not enough to overflow chrome. */
export const CHROME_FONT_MAX = 1.35;

const clamp = (
  value: number,
  lower: number,
  upper: number,
): number =>
  Math.min(upper, Math.max(lower, value));

const round1 = (value: number): number =>
  Math.round(value * 10) / 10;

/**
 * Scale factor for a given window width.
 */
export const factorFor = (width: number): number =>
  clamp(
    width / BASE_WIDTH,
    MIN_FACTOR,
    MAX_FACTOR,
  );

export const fontFactorFor = (width: number): number =>
  clamp(
    width / BASE_WIDTH,
    FONT_MIN_FACTOR,
    FONT_MAX_FACTOR,
  );

const window = Dimensions.get('window');
const shortest = Math.min(window.width, window.height);

export const scaleFactor = factorFor(shortest);
export const fontScaleFactor = fontFactorFor(shortest);

/**
 * Design size in points. Floor at 11 (Apple / Material minimum); no extra bump.
 */
export const liftFont = (n: number): number =>
  Math.max(MIN_FONT, n);

export const fs = (n: number): number =>
  round1(Math.max(MIN_FONT, liftFont(n) * fontScaleFactor));

/**
 * Proportional scaling for layout dimensions.
 */
export const ms = (n: number): number =>
  round1(n * scaleFactor);

/**
 * Control-height scaling.
 */
export const liftControl = (n: number): number =>
  n < 30
    ? n * 1.25
    : Math.max(40, n * 1.17);

export const ch = (n: number): number =>
  Math.round(liftControl(n) * scaleFactor);

/**
 * Minimum comfortable touch target in points.
 */
export const MIN_TOUCH = 44;
