import { api, unwrap, unwrapPage } from './apiClient';
import type { HistoryItem, Stats, Streaks } from './types';

export interface LocalMatchUpload {
  clientMatchId: string;
  size: 3 | 4 | 5;
  winLength: number;
  mode: 'LOCAL_2P' | 'VS_AI';
  difficulty?: string;
  humanMark?: 'X' | 'O';
  moves: number[];
  durationMs: number;
  playedAt?: string;
}
export interface LocalSyncResult {
  accepted: number;
  duplicates: number;
  rejected: Array<{ clientMatchId: string; reason: string }>;
}

export const statisticsApi = {
  me: () => unwrap<Stats>(api.get('/statistics/me')),
  streaks: () => unwrap<Streaks>(api.get('/statistics/me/streaks')),
  history: (params: { page?: number; limit?: number; type?: string; result?: 'WIN' | 'LOSS' | 'DRAW' } = {}) =>
    unwrapPage<HistoryItem>(api.get('/statistics/me/history', { params: { limit: 30, ...params } })),
  /** The server replays every match through the shared engine; claimed results are ignored. Idempotent per clientMatchId. */
  syncLocalMatches: (matches: LocalMatchUpload[]) => unwrap<LocalSyncResult>(api.post('/statistics/me/local-matches', { matches })),
};
