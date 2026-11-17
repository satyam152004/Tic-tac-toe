import { api, unwrapPage } from './apiClient';
import type { LeaderboardMe, LeaderboardRow } from './types';

export type LeaderboardScope = 'global' | 'daily' | 'weekly' | 'monthly' | 'friends';
export type LeaderboardMetric = 'points' | 'wins';

export interface LeaderboardResult {
  rows: LeaderboardRow[];
  me: LeaderboardMe | null;
  total: number;
}

export const leaderboardApi = {
  async get(scope: LeaderboardScope, metric: LeaderboardMetric = 'points', page = 1): Promise<LeaderboardResult> {
    const r = await unwrapPage<LeaderboardRow>(api.get(`/leaderboard/${scope}`, { params: { metric, page, limit: 50 } }));
    return { rows: r.items, total: r.total, me: (r.meta.me as LeaderboardMe | undefined) ?? null };
  },
};
