import { Dimensions } from 'react-native';

export const BASE_WIDTH = 390;
export const MIN_FACTOR = 0.9;
export const MAX_FACTOR = 1.2;

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

const window = Dimensions.get('window');

export const scaleFactor = factorFor(
  Math.min(window.width, window.height),
);

/**
 * Kit text size -> readable size before screen scaling.
 */
export const liftFont = (n: number): number => {
  const bump =
    n <= 13
      ? 2
      : Math.max(0, 2 - (n - 13) * 0.4);

  return Math.max(12, n + bump);
};

export const fs = (n: number): number =>
  round1(liftFont(n) * scaleFactor);

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