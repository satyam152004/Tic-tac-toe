/** Palette taken verbatim from the approved prototype (index.css). */
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

const shared = {
  success: '#22C55E',
  warning: '#FBBF24',
  danger: '#EF4444',
  onAccent: '#FFFFFF',
  /** Text on a warning (amber) surface. */
  onWarning: '#1A1200',
  dangerSoft: 'rgba(239,68,68,0.14)',
  dangerBorder: 'rgba(239,68,68,0.40)',
  scrim: 'rgba(0,0,0,0.65)',
} as const;
const DANGER_TEXT_ON_DARK = '#F87171';
const DANGER_TEXT_ON_LIGHT = '#B91C1C';

export const THEME_COLORS: Record<ThemeId, ThemeColors> = {
  dark: { bgPrimary: '#0B0718', bgSecondary: '#15102A', bgCard: '#1C1635', bgElevated: '#241D44', accent: '#8B5CF6', accentSecondary: '#6D28D9', accentFill: '#7C3AED', x: '#38BDF8', o: '#F472B6', text: '#FFFFFF', textSecondary: '#A8A0BC', border: '#30264D', dangerText: DANGER_TEXT_ON_DARK, ...shared },
  light: { bgPrimary: '#F7F6FB', bgSecondary: '#EFEBF8', bgCard: '#FFFFFF', bgElevated: '#F3F0FA', accent: '#7C3AED', accentSecondary: '#5B21B6', accentFill: '#7C3AED', x: '#0284C7', o: '#DB2777', text: '#140E26', textSecondary: '#5C5375', border: '#DDD6EE', dangerText: DANGER_TEXT_ON_LIGHT, ...shared },
  classic: { bgPrimary: '#100E1B', bgSecondary: '#19162B', bgCard: '#221E38', bgElevated: '#2B2645', accent: '#8B5CF6', accentSecondary: '#6D28D9', accentFill: '#7C3AED', x: '#60A5FA', o: '#FB7185', text: '#F8FAFC', textSecondary: '#B4ADC9', border: '#373056', dangerText: DANGER_TEXT_ON_DARK, ...shared },
  neon: { bgPrimary: '#070414', bgSecondary: '#110A29', bgCard: '#181038', bgElevated: '#22174D', accent: '#A855F7', accentSecondary: '#7E22CE', accentFill: '#9333EA', x: '#22D3EE', o: '#F43F5E', text: '#FFFFFF', textSecondary: '#B2A6D4', border: '#3A256E', dangerText: DANGER_TEXT_ON_DARK, ...shared },
  ocean: { bgPrimary: '#06131F', bgSecondary: '#0C1F31', bgCard: '#122A42', bgElevated: '#193754', accent: '#8B5CF6', accentSecondary: '#0284C7', accentFill: '#7C3AED', x: '#38BDF8', o: '#34D399', text: '#F0F9FF', textSecondary: '#94B4CC', border: '#214566', dangerText: DANGER_TEXT_ON_DARK, ...shared },
  sunset: { bgPrimary: '#160A18', bgSecondary: '#221125', bgCard: '#2C1630', bgElevated: '#381D3D', accent: '#8B5CF6', accentSecondary: '#C026D3', accentFill: '#7C3AED', x: '#FBBF24', o: '#F472B6', text: '#FFF7FB', textSecondary: '#C7AACB', border: '#49284F', dangerText: DANGER_TEXT_ON_DARK, ...shared },
};

export const THEME_IDS: ThemeId[] = ['dark', 'neon', 'classic', 'light', 'ocean', 'sunset'];

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
