import { ThemeColors, ThemeId, THEME_COLORS, THEME_IDS } from './colors';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  subtitle: string;
  isLight: boolean;
}

export const THEME_LIST: ThemeDefinition[] = [
  { id: 'dark', name: 'Dark Theme', subtitle: 'Signature deep obsidian & violet', isLight: false },
  { id: 'neon', name: 'Neon Theme', subtitle: 'High-contrast arena glow', isLight: false },
  { id: 'classic', name: 'Classic Theme', subtitle: 'Balanced slate & crisp symbols', isLight: false },
  { id: 'light', name: 'Light Theme', subtitle: 'Daylight contrast & clean surfaces', isLight: true },
  { id: 'ocean', name: 'Ocean Theme', subtitle: 'Deep abyssal teal & cyan', isLight: false },
  { id: 'sunset', name: 'Sunset Theme', subtitle: 'Dusk plum, amber & magenta', isLight: false },
];

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && (THEME_IDS as string[]).includes(v);
export const getThemeColors = (id: ThemeId): ThemeColors => THEME_COLORS[id];
