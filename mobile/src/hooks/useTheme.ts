import { useMemo } from 'react';
import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { ThemeColors } from '../design-system/colors';
import { getThemeColors } from '../design-system/themes';
import { useSettingsStore } from '../store/settingsStore';

export const useTheme = (): ThemeColors => {
  const id = useSettingsStore((s) => s.theme);
  return getThemeColors(id);
};

type Styles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/** Builds a StyleSheet from the active theme, memoised per theme change. */
export function useThemedStyles<T extends Styles>(factory: (c: ThemeColors) => T): T {
  const c = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(factory(c)) as T, [c]);
}
