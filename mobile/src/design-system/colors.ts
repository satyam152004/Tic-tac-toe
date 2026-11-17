/** Palette taken verbatim from the approved prototype (index.css). */
export type ThemeId = 'dark' | 'light' | 'classic' | 'neon' | 'ocean' | 'sunset';

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  bgElevated: string;
  accent: string;
  accentSecondary: string;
  x: string;
  o: string;
  success: string;
  warning: string;
  danger: string;
  text: string;
  textSecondary: string;
  border: string;
}

const shared = { success: '#22C55E', warning: '#FBBF24', danger: '#EF4444' } as const;

export const THEME_COLORS: Record<ThemeId, ThemeColors> = {
  dark: { bgPrimary: '#0B0718', bgSecondary: '#15102A', bgCard: '#1C1635', bgElevated: '#241D44', accent: '#8B5CF6', accentSecondary: '#6D28D9', x: '#38BDF8', o: '#F472B6', text: '#FFFFFF', textSecondary: '#A8A0BC', border: '#30264D', ...shared },
  light: { bgPrimary: '#F7F6FB', bgSecondary: '#EFEBF8', bgCard: '#FFFFFF', bgElevated: '#F3F0FA', accent: '#7C3AED', accentSecondary: '#5B21B6', x: '#0284C7', o: '#DB2777', text: '#140E26', textSecondary: '#5C5375', border: '#DDD6EE', ...shared },
  classic: { bgPrimary: '#100E1B', bgSecondary: '#19162B', bgCard: '#221E38', bgElevated: '#2B2645', accent: '#8B5CF6', accentSecondary: '#6D28D9', x: '#60A5FA', o: '#FB7185', text: '#F8FAFC', textSecondary: '#B4ADC9', border: '#373056', ...shared },
  neon: { bgPrimary: '#070414', bgSecondary: '#110A29', bgCard: '#181038', bgElevated: '#22174D', accent: '#A855F7', accentSecondary: '#7E22CE', x: '#22D3EE', o: '#F43F5E', text: '#FFFFFF', textSecondary: '#B2A6D4', border: '#3A256E', ...shared },
  ocean: { bgPrimary: '#06131F', bgSecondary: '#0C1F31', bgCard: '#122A42', bgElevated: '#193754', accent: '#8B5CF6', accentSecondary: '#0284C7', x: '#38BDF8', o: '#34D399', text: '#F0F9FF', textSecondary: '#94B4CC', border: '#214566', ...shared },
  sunset: { bgPrimary: '#160A18', bgSecondary: '#221125', bgCard: '#2C1630', bgElevated: '#381D3D', accent: '#8B5CF6', accentSecondary: '#C026D3', x: '#FBBF24', o: '#F472B6', text: '#FFF7FB', textSecondary: '#C7AACB', border: '#49284F', ...shared },
};

export const THEME_IDS: ThemeId[] = ['dark', 'neon', 'classic', 'light', 'ocean', 'sunset'];
