import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
} from '@expo-google-fonts/plus-jakarta-sans';

/**
 * The only fonts the app loads. `App.tsx` passes this map to `useFonts`, and the `fonts` tokens below are the only
 * way screens name a font family, so a style can never reference a font that is not loaded
 * (tests/unit/fonts.test.ts enforces both).
 *
 *  - Plus Jakarta Sans: every piece of text.
 *  - JetBrains Mono:    timers, scores, counters and codes only (tabular digits).
 *
 * Weights stay light on purpose: regular for reading, medium for emphasis, semibold for headings and buttons.
 * There is no bold or extra-bold.
 */
export const FONT_ASSETS = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} as const;

export const fonts = {
  body: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
  },
  mono: {
    regular: 'JetBrainsMono_400Regular',
    medium: 'JetBrainsMono_500Medium',
    semibold: 'JetBrainsMono_600SemiBold',
  },
} as const satisfies Record<string, Record<string, keyof typeof FONT_ASSETS>>;
