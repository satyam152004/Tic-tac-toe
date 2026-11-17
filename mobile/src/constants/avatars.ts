
export interface AvatarPreset {
  id: string;
  label: string;
  initials: string;
  colors: [string, string];
  image?: number;
}

/** Preset ids are what the backend stores in `user.avatar` (free-form string, max 300 chars). */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'av_1', label: 'Aiden', initials: 'AV', colors: ['#8B5CF6', '#38BDF8'] },
  { id: 'av_2', label: 'Maya', initials: 'MK', colors: ['#F472B6', '#8B5CF6'] },
  { id: 'av_3', label: 'Liam', initials: 'LC', colors: ['#38BDF8', '#22C55E'] },
  { id: 'av_4', label: 'Nora', initials: 'NR', colors: ['#FBBF24', '#F472B6'] },
  { id: 'av_5', label: 'Kaito', initials: 'KT', colors: ['#6D28D9', '#F472B6'] },
  { id: 'av_ai', label: 'Vortex AI', initials: 'AI', colors: ['#6D28D9', '#38BDF8'], image: require('../assets/images/ai_strategist_avatar_1794905720847.jpg') },
];

export const SELECTABLE_AVATARS = AVATAR_PRESETS.filter((a) => a.id !== 'av_ai');
export const AI_AVATAR_ID = 'av_ai';

/** The backend only accepts `avatar_[a-z0-9_]{1,40}` (or an https URL); presets are `av_*` locally. */
export const toServerAvatar = (id: string): string => (id.startsWith('av_') ? `avatar_${id.slice(3)}` : id);
export const fromServerAvatar = (value?: string | null): string => (value && value.startsWith('avatar_') ? `av_${value.slice(7)}` : (value ?? ''));

export const findAvatar = (id?: string | null): AvatarPreset =>
  AVATAR_PRESETS.find((a) => a.id === id || a.id === fromServerAvatar(id)) ?? AVATAR_PRESETS[0];

export const ONBOARDING_IMAGES = {
  classic: require('../assets/images/onboarding_classic_board_1794905719190.jpg'),
  ai: require('../assets/images/onboarding_ai_duel_1794905719156.jpg'),
  online: require('../assets/images/onboarding_online_arena_1794905720191.jpg'),
} as const;
