import { TextStyle } from 'react-native';
import { fonts } from './fonts';
import { fs } from './responsive';

export { fonts };

const lh = (size: number, ratio = 1.3): number =>
  Math.round(fs(size) * ratio);

/**
 * Mobile type scale aligned with iOS HIG + Material 3 (phone).
 *
 * Body ~15–16, nav titles 17 semibold, captions 12, never below 11.
 * Sizes use `fs()` so they stay stable across phone widths; OS Large/Small
 * text is applied by React Native `allowFontScaling`.
 *
 * Weights:
 * 400 = Regular
 * 500 = Medium
 * 600 = Semibold
 */
export const type = {
  display: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(28),
    lineHeight: lh(28, 1.25),
    letterSpacing: -0.5,
  } as TextStyle,

  displaySmall: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(24),
    lineHeight: lh(24, 1.25),
    letterSpacing: -0.35,
  } as TextStyle,

  title: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(22),
    lineHeight: lh(22, 1.27),
    letterSpacing: -0.3,
  } as TextStyle,

  headline: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(20),
    lineHeight: lh(20, 1.3),
    letterSpacing: -0.2,
  } as TextStyle,

  heading: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(17),
    lineHeight: lh(17),
  } as TextStyle,

  subheading: {
    fontFamily: fonts.body.medium,
    fontSize: fs(16),
    lineHeight: lh(16),
  } as TextStyle,

  titleLarge: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(17),
    lineHeight: lh(17),
  } as TextStyle,

  titleMedium: {
    fontFamily: fonts.body.medium,
    fontSize: fs(16),
    lineHeight: lh(16),
  } as TextStyle,

  body: {
    fontFamily: fonts.body.regular,
    fontSize: fs(15),
    lineHeight: lh(15, 1.4),
  } as TextStyle,

  bodyStrong: {
    fontFamily: fonts.body.medium,
    fontSize: fs(15),
    lineHeight: lh(15, 1.4),
  } as TextStyle,

  bodyLarge: {
    fontFamily: fonts.body.regular,
    fontSize: fs(16),
    lineHeight: lh(16, 1.45),
  } as TextStyle,

  bodySmall: {
    fontFamily: fonts.body.regular,
    fontSize: fs(14),
    lineHeight: lh(14, 1.4),
  } as TextStyle,

  label: {
    fontFamily: fonts.body.medium,
    fontSize: fs(13),
    lineHeight: lh(13),
  } as TextStyle,

  labelStrong: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(13),
    lineHeight: lh(13),
  } as TextStyle,

  button: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(15),
    lineHeight: lh(15, 1.3),
  } as TextStyle,

  small: {
    fontFamily: fonts.body.regular,
    fontSize: fs(13),
    lineHeight: lh(13),
  } as TextStyle,

  smallStrong: {
    fontFamily: fonts.body.medium,
    fontSize: fs(13),
    lineHeight: lh(13),
  } as TextStyle,

  caption: {
    fontFamily: fonts.body.medium,
    fontSize: fs(12),
    lineHeight: lh(12, 1.35),
  } as TextStyle,

  overline: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(11),
    lineHeight: lh(11, 1.35),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } as TextStyle,

  num: {
    fontFamily: fonts.mono.medium,
    fontSize: fs(15),
    lineHeight: lh(15),
  } as TextStyle,

  numLarge: {
    fontFamily: fonts.mono.medium,
    fontSize: fs(20),
    lineHeight: lh(20, 1.3),
  } as TextStyle,

  numHero: {
    fontFamily: fonts.mono.semibold,
    fontSize: fs(24),
    lineHeight: lh(24, 1.25),
  } as TextStyle,

  code: {
    fontFamily: fonts.mono.semibold,
    fontSize: fs(22),
    lineHeight: lh(22, 1.25),
    letterSpacing: 0.5,
  } as TextStyle,
} as const;

export type TypeVariant = keyof typeof type;
