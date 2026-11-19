import { TextStyle } from 'react-native';
import { fonts } from './fonts';

export { fonts };

/**
 * The type scale. Every piece of text in the app takes one of these (spread a variant, override only the colour and
 * alignment); do not set fontSize / fontFamily / fontWeight inline. Plus Jakarta Sans throughout, JetBrains Mono for
 * numbers that change (timer, score, counters, codes).
 *
 *   variant      size/line   weight     use
 *   title        24/30       semibold   one per screen at most (hero / result headline)
 *   headline     20/26       semibold   dialog titles, section heroes
 *   heading      17/22       semibold   screen headers, card titles
 *   subheading   15/20       medium     row titles, list headings
 *   body         14/20       regular    paragraphs, descriptions
 *   bodyStrong   14/20       medium     emphasised body, names
 *   small        12/17       regular    secondary text
 *   smallStrong  12/17       medium     secondary text with emphasis
 *   caption      11/15       medium     labels, meta, badges
 *   button       15/20       semibold   button labels
 *   num          14/20       mono med   inline numbers (timer, counters)
 *   numLarge     20/26       mono med   scores and stats
 *   numHero      28/34       mono med   the one big number on a screen
 *   code         24/30       mono semi  room / OTP codes (add letterSpacing at the call site)
 *
 * Line heights always exceed the font size by at least 25%, so glyphs never clip, including on Android.
 */
export const type = {
  title: { fontFamily: fonts.body.semibold, fontSize: 24, lineHeight: 30 } as TextStyle,
  headline: { fontFamily: fonts.body.semibold, fontSize: 20, lineHeight: 26 } as TextStyle,
  heading: { fontFamily: fonts.body.semibold, fontSize: 17, lineHeight: 22 } as TextStyle,
  subheading: { fontFamily: fonts.body.medium, fontSize: 15, lineHeight: 20 } as TextStyle,
  body: { fontFamily: fonts.body.regular, fontSize: 14, lineHeight: 20 } as TextStyle,
  bodyStrong: { fontFamily: fonts.body.medium, fontSize: 14, lineHeight: 20 } as TextStyle,
  small: { fontFamily: fonts.body.regular, fontSize: 12, lineHeight: 17 } as TextStyle,
  smallStrong: { fontFamily: fonts.body.medium, fontSize: 12, lineHeight: 17 } as TextStyle,
  caption: { fontFamily: fonts.body.medium, fontSize: 11, lineHeight: 15 } as TextStyle,
  button: { fontFamily: fonts.body.semibold, fontSize: 15, lineHeight: 20 } as TextStyle,
  num: { fontFamily: fonts.mono.medium, fontSize: 14, lineHeight: 20 } as TextStyle,
  numLarge: { fontFamily: fonts.mono.medium, fontSize: 20, lineHeight: 26 } as TextStyle,
  numHero: { fontFamily: fonts.mono.medium, fontSize: 28, lineHeight: 34 } as TextStyle,
  code: { fontFamily: fonts.mono.semibold, fontSize: 24, lineHeight: 30 } as TextStyle,
} as const;

export type TypeVariant = keyof typeof type;
