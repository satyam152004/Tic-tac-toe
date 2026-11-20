/** Palette aligned with the Clean & Minimal UI Kit (53 Views) while preserving all 6 theme IDs. */
export type ThemeId = 'dark' | 'light' | 'classic' | 'neon' | 'ocean' | 'sunset';

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  bgElevated: string;
  accent: string;
  accentSecondary: string;
  /** Accent for filled surfaces (primary button, Play tab, checkmarks): dark enough for `onAccent` text at 4.5:1. Use `accent` for icons, text and borders. */
  accentFill: string;
  x: string;
  o: string;
  success: string;
  warning: string;
  danger: string;
  text: string;
  textSecondary: string;
  border: string;
  /** Text/icon colour on an accent or danger-filled surface. */
  onAccent: string;
  onWarning: string;
  /** Danger colour that is readable as text on this theme's surfaces (danger itself is for fills and icons). */
  dangerText: string;
  dangerSoft: string;
  dangerBorder: string;
  /** Backdrop behind dialogs and sheets. */
  scrim: string;
}

const sharedDark = {
  success: '#22C55E',
  warning: '#FBBF24',
  danger: '#EF4444',
  onAccent: '#FFFFFF',
  onWarning: '#1A1200',
  dangerSoft: 'rgba(239,68,68,0.14)',
  dangerBorder: 'rgba(239,68,68,0.40)',
  scrim: 'rgba(0,0,0,0.65)',
} as const;

const sharedLight = {
  success: '#15803D',
  warning: '#F59E0B',
  danger: '#B91C1C',
  onAccent: '#FFFFFF',
  onWarning: '#1A1200',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  scrim: 'rgba(20,21,24,0.45)',
} as const;

const DANGER_TEXT_ON_DARK = '#F87171';
const DANGER_TEXT_ON_LIGHT = '#B91C1C';

export const THEME_COLORS: Record<ThemeId, ThemeColors> = {
  light: {
    bgPrimary: '#F8F8F6',
    bgSecondary: '#F1F1EE',
    bgCard: '#FFFFFF',
    bgElevated: '#EFF4FF',
    accent: '#1D4ED8',
    accentSecondary: '#1E40AF',
    accentFill: '#1D4ED8',
    x: '#1D4ED8',
    o: '#141518',
    text: '#141518',
    textSecondary: '#5C606A',
    border: '#E4E4DF',
    dangerText: DANGER_TEXT_ON_LIGHT,
    ...sharedLight,
  },
  classic: {
    bgPrimary: '#F5F2EB',
    bgSecondary: '#ECE6DA',
    bgCard: '#FFFDF9',
    bgElevated: '#EFF4FF',
    accent: '#1D4ED8',
    accentSecondary: '#1E40AF',
    accentFill: '#1D4ED8',
    x: '#1D4ED8',
    o: '#1C1917',
    text: '#1C1917',
    textSecondary: '#57534E',
    border: '#E6DFD3',
    dangerText: DANGER_TEXT_ON_LIGHT,
    ...sharedLight,
  },
  dark: {
    bgPrimary: '#141518',
    bgSecondary: '#1B1D22',
    bgCard: '#22242A',
    bgElevated: '#2B2E36',
    accent: '#60A5FA',
    accentSecondary: '#3B82F6',
    accentFill: '#2563EB',
    x: '#60A5FA',
    o: '#F8FAFC',
    text: '#F8FAFC',
    textSecondary: '#A1A7B4',
    border: '#323640',
    dangerText: DANGER_TEXT_ON_DARK,
    ...sharedDark,
  },
  neon: { bgPrimary: '#070414', bgSecondary: '#110A29', bgCard: '#181038', bgElevated: '#22174D', accent: '#A855F7', accentSecondary: '#7E22CE', accentFill: '#9333EA', x: '#22D3EE', o: '#F43F5E', text: '#FFFFFF', textSecondary: '#B2A6D4', border: '#3A256E', dangerText: DANGER_TEXT_ON_DARK, ...sharedDark },
  ocean: { bgPrimary: '#06131F', bgSecondary: '#0C1F31', bgCard: '#122A42', bgElevated: '#193754', accent: '#38BDF8', accentSecondary: '#0284C7', accentFill: '#0369A1', x: '#38BDF8', o: '#34D399', text: '#F0F9FF', textSecondary: '#94B4CC', border: '#214566', dangerText: DANGER_TEXT_ON_DARK, ...sharedDark },
  sunset: { bgPrimary: '#160A18', bgSecondary: '#221125', bgCard: '#2C1630', bgElevated: '#381D3D', accent: '#E879F9', accentSecondary: '#C026D3', accentFill: '#A21CAF', x: '#FBBF24', o: '#F472B6', text: '#FFF7FB', textSecondary: '#C7AACB', border: '#49284F', dangerText: DANGER_TEXT_ON_DARK, ...sharedDark },
};

export const THEME_IDS: ThemeId[] = ['light', 'classic', 'dark', 'neon', 'ocean', 'sunset'];

/**
 * `color` at the given opacity (0..1). Use this instead of appending hex digits (`c.accent + '33'`), which silently
 * breaks as soon as a colour is not a 6-digit hex string. Accepts #RGB and #RRGGBB.
 */
export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.min(1, Math.max(0, alpha))})`;
}
