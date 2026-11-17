import { TextStyle } from 'react-native';

export const fonts = {
  display: { medium: 'Outfit_500Medium', semibold: 'Outfit_600SemiBold', bold: 'Outfit_700Bold', extrabold: 'Outfit_800ExtraBold' },
  body: { regular: 'PlusJakartaSans_400Regular', medium: 'PlusJakartaSans_500Medium', semibold: 'PlusJakartaSans_600SemiBold', bold: 'PlusJakartaSans_700Bold' },
  mono: { medium: 'JetBrainsMono_500Medium', semibold: 'JetBrainsMono_600SemiBold', bold: 'JetBrainsMono_700Bold' },
} as const;

/** Sizes follow the prototype's Tailwind scale (px). */
export const type = {
  title: { fontFamily: fonts.display.bold, fontSize: 28, lineHeight: 34 } as TextStyle,
  headline: { fontFamily: fonts.display.bold, fontSize: 20, lineHeight: 26 } as TextStyle,
  heading: { fontFamily: fonts.display.bold, fontSize: 17, lineHeight: 22 } as TextStyle,
  subheading: { fontFamily: fonts.display.semibold, fontSize: 15, lineHeight: 20 } as TextStyle,
  body: { fontFamily: fonts.body.regular, fontSize: 14, lineHeight: 20 } as TextStyle,
  bodyStrong: { fontFamily: fonts.body.semibold, fontSize: 14, lineHeight: 20 } as TextStyle,
  small: { fontFamily: fonts.body.regular, fontSize: 12, lineHeight: 17 } as TextStyle,
  smallStrong: { fontFamily: fonts.body.semibold, fontSize: 12, lineHeight: 17 } as TextStyle,
  caption: { fontFamily: fonts.body.medium, fontSize: 11, lineHeight: 15 } as TextStyle,
  button: { fontFamily: fonts.body.semibold, fontSize: 15, lineHeight: 20 } as TextStyle,
  num: { fontFamily: fonts.mono.bold, fontSize: 14, lineHeight: 20 } as TextStyle,
} as const;
