import { api, unwrap, unwrapPage } from './apiClient';
import type { Me, PlayerCard, PublicProfile, ThemeId } from './types';

export type ReportReason = 'CHEATING' | 'ABUSE' | 'STALLING' | 'SPAM' | 'INAPPROPRIATE_NAME' | 'OTHER';

export interface UpdateMeInput {
  username?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  timezone?: string;
  theme?: ThemeId;
  language?: string;
  sound?: { effects?: boolean; music?: boolean; volume?: number };
  notificationPrefs?: { social?: boolean; game?: boolean; achievements?: boolean };
  privacy?: { allowSpectating?: boolean };
}

export const userApi = {
  me: () => unwrap<Me>(api.get('/users/me')),
  update: (input: UpdateMeInput) => unwrap<Me>(api.patch('/users/me', input)),
  remove: (password?: string) => unwrap<{ deleted: true }>(api.delete('/users/me', { data: password ? { password } : {} })),
  get: (id: string) => unwrap<PublicProfile>(api.get(`/users/${id}`)),
  search: (q: string, page = 1) => unwrapPage<PlayerCard>(api.get('/users/search', { params: { q, page, limit: 20 } })),
  report: (id: string, reason: ReportReason, details?: string, gameId?: string) =>
    unwrap(api.post(`/users/${id}/report`, { reason, details, gameId })),
  registerDevice: (token: string, platform: 'android' | 'ios', deviceName?: string) => unwrap<{ id: string }>(api.post('/devices/register', { token, platform, deviceName })),
  removeDevice: (id: string) => unwrap(api.delete(`/devices/${id}`)),
};
