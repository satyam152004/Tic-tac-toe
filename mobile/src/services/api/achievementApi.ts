import { api, unwrap } from './apiClient';
import type { AchievementItem, MyAchievements } from './types';

export const achievementApi = {
  catalogue: () => unwrap<AchievementItem[]>(api.get('/achievements')),
  mine: () => unwrap<MyAchievements>(api.get('/achievements/me')),
};
