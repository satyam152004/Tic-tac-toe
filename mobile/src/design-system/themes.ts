import { ThemeColors, ThemeId, THEME_COLORS, THEME_IDS } from './colors';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  subtitle: string;
  isLight: boolean;
}

export const THEME_LIST: ThemeDefinition[] = [
  { id: 'light', name: 'Clean Light', subtitle: 'Off-white canvas with Cobalt accent', isLight: true },
  { id: 'classic', name: 'Warm Paper', subtitle: 'Soft ivory editorial surface', isLight: true },
  { id: 'dark', name: 'Soft Slate', subtitle: 'Low-glare charcoal slate palette', isLight: false },
  { id: 'neon', name: 'Neon Arena', subtitle: 'High-contrast dark violet glow', isLight: false },
  { id: 'ocean', name: 'Deep Ocean', subtitle: 'Abyssal teal & crisp cyan', isLight: false },
  { id: 'sunset', name: 'Dusk Sunset', subtitle: 'Warm plum, amber & magenta', isLight: false },
];

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && (THEME_IDS as string[]).includes(v);
export const getThemeColors = (id: ThemeId): ThemeColors => THEME_COLORS[id];
