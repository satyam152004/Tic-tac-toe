import { TextStyle } from 'react-native';
import { fonts } from './fonts';
import { ms } from './responsive';

export { fonts };

/**
 * The type scale. Every piece of text in the app takes one of these (spread a variant, override only the colour and
 * alignment); do not set fontSize / fontFamily / fontWeight inline. Plus Jakarta Sans throughout, JetBrains Mono for
 * numbers that change (timer, score, counters, codes).
 *
 *   variant      size/line   weight     use
 *   title        26/32       semibold   one per screen at most (hero / result headline)
 *   headline     21/27       semibold   dialog titles, section heroes
 *   heading      18/24       semibold   screen headers, card titles
 *   subheading   16/22       medium     row titles, list headings
 *   body         15/22       regular    paragraphs, descriptions
 *   bodyStrong   15/22       medium     emphasised body, names
 *   small        13/18       regular    secondary text
 *   smallStrong  13/18       medium     secondary text with emphasis
 *   caption      12/16       medium     labels, meta, badges (nothing is smaller than 12)
 *   button       16/22       semibold   button labels
 *   num          15/21       mono med   inline numbers (timer, counters)
 *   numLarge     21/27       mono med   scores and stats
 *   numHero      30/36       mono med   the one big number on a screen
 *   code         26/32       mono semi  room / OTP codes (add letterSpacing at the call site)
 *
 * All sizes are base sizes for a 390 pt phone and scale with the screen width (see responsive.ts).
 *
 * Line heights always exceed the font size by at least 25%, so glyphs never clip, including on Android.
 */
export const type = {
  title: { fontFamily: fonts.body.semibold, fontSize: ms(26), lineHeight: ms(32) } as TextStyle,
  headline: { fontFamily: fonts.body.semibold, fontSize: ms(21), lineHeight: ms(27) } as TextStyle,
  heading: { fontFamily: fonts.body.semibold, fontSize: ms(18), lineHeight: ms(24) } as TextStyle,
  subheading: { fontFamily: fonts.body.medium, fontSize: ms(16), lineHeight: ms(22) } as TextStyle,
  body: { fontFamily: fonts.body.regular, fontSize: ms(15), lineHeight: ms(22) } as TextStyle,
  bodyStrong: { fontFamily: fonts.body.medium, fontSize: ms(15), lineHeight: ms(22) } as TextStyle,
  small: { fontFamily: fonts.body.regular, fontSize: ms(13), lineHeight: ms(18) } as TextStyle,
  smallStrong: { fontFamily: fonts.body.medium, fontSize: ms(13), lineHeight: ms(18) } as TextStyle,
  caption: { fontFamily: fonts.body.medium, fontSize: ms(12), lineHeight: ms(16) } as TextStyle,
  button: { fontFamily: fonts.body.semibold, fontSize: ms(16), lineHeight: ms(22) } as TextStyle,
  num: { fontFamily: fonts.mono.medium, fontSize: ms(15), lineHeight: ms(21) } as TextStyle,
  numLarge: { fontFamily: fonts.mono.medium, fontSize: ms(21), lineHeight: ms(27) } as TextStyle,
  numHero: { fontFamily: fonts.mono.medium, fontSize: ms(30), lineHeight: ms(36) } as TextStyle,
  code: { fontFamily: fonts.mono.semibold, fontSize: ms(26), lineHeight: ms(32) } as TextStyle,
} as const;

export type TypeVariant = keyof typeof type;
