import { TextStyle } from 'react-native';
import { fonts } from './fonts';
import { ms } from './responsive';

export { fonts };

/**
 * Central typography system.
 *
 * Body: Plus Jakarta Sans
 * Numbers: JetBrains Mono
 *
 * Weights:
 * 400 = Regular
 * 500 = Medium
 * 600 = Semibold
 *
 * All sizes are scaled using the existing responsive helper.
 */
export const type = {
  // Display
  display: {
    fontFamily: fonts.body.semibold,
    fontSize: ms(32),
    lineHeight: ms(40),
    letterSpacing: -0.6,
  } as TextStyle,

  displaySmall: {
    fontFamily: fonts.body.semibold,
    fontSize: ms(28),
    lineHeight: ms(36),
    letterSpacing: -0.4,
  } as TextStyle,

  // Headings
  title: {
    fontFamily: fonts.body.semibold,
    fontSize: ms(26),
    lineHeight: ms(34),
    letterSpacing: -0.3,
  } as TextStyle,

  headline: {
    fontFamily: fonts.body.semibold,
    fontSize: ms(22),
    lineHeight: ms(30),
    letterSpacing: -0.2,
  } as TextStyle,

  heading: {
    fontFamily: fonts.body.semibold,
    fontSize: ms(20),
    lineHeight: ms(28),
  } as TextStyle,

  subheading: {
    fontFamily: fonts.body.medium,
    fontSize: ms(18),
    lineHeight: ms(26),
  } as TextStyle,

  // Titles
  titleLarge: {
    fontFamily: fonts.body.semibold,
    fontSize: ms(18),
    lineHeight: ms(26),
  } as TextStyle,

  titleMedium: {
    fontFamily: fonts.body.medium,
    fontSize: ms(16),
    lineHeight: ms(24),
  } as TextStyle,

  // Body
  body: {
    fontFamily: fonts.body.regular,
    fontSize: ms(15),
    lineHeight: ms(23),
  } as TextStyle,

  bodyStrong: {
    fontFamily: fonts.body.medium,
    fontSize: ms(15),
    lineHeight: ms(23),
  } as TextStyle,

  bodyLarge: {
    fontFamily: fonts.body.regular,
    fontSize: ms(16),
    lineHeight: ms(24),
  } as TextStyle,

  bodySmall: {
    fontFamily: fonts.body.regular,
    fontSize: ms(14),
    lineHeight: ms(21),
  } as TextStyle,

  // Labels
  label: {
    fontFamily: fonts.body.medium,
    fontSize: ms(14),
    lineHeight: ms(20),
  } as TextStyle,

  labelStrong: {
    fontFamily: fonts.body.semibold,
    fontSize: ms(14),
    lineHeight: ms(20),
  } as TextStyle,

  button: {
    fontFamily: fonts.body.semibold,
    fontSize: ms(16),
    lineHeight: ms(22),
  } as TextStyle,

  // Supporting text
  small: {
    fontFamily: fonts.body.regular,
    fontSize: ms(13),
    lineHeight: ms(19),
  } as TextStyle,

  smallStrong: {
    fontFamily: fonts.body.medium,
    fontSize: ms(13),
    lineHeight: ms(19),
  } as TextStyle,

  caption: {
    fontFamily: fonts.body.medium,
    fontSize: ms(12),
    lineHeight: ms(17),
  } as TextStyle,

  overline: {
    fontFamily: fonts.body.semibold,
    fontSize: ms(11),
    lineHeight: ms(16),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } as TextStyle,

  // Game numbers
  num: {
    fontFamily: fonts.mono.medium,
    fontSize: ms(15),
    lineHeight: ms(22),
  } as TextStyle,

  numLarge: {
    fontFamily: fonts.mono.medium,
    fontSize: ms(21),
    lineHeight: ms(29),
  } as TextStyle,

  numHero: {
    fontFamily: fonts.mono.semibold,
    fontSize: ms(30),
    lineHeight: ms(40),
  } as TextStyle,

  code: {
    fontFamily: fonts.mono.semibold,
    fontSize: ms(26),
    lineHeight: ms(34),
    letterSpacing: 0.5,
  } as TextStyle,
} as const;

export type TypeVariant = keyof typeof type;