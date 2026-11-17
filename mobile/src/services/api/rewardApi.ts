import { api, unwrap } from './apiClient';
import type { DailyClaimResult, DailyRewardStatus } from './types';

/** Server-authoritative: the client only displays status and requests a claim; amounts are decided by the backend. */
export const rewardApi = {
  status: () => unwrap<DailyRewardStatus>(api.get('/rewards/daily')),
  claim: () => unwrap<DailyClaimResult>(api.post('/rewards/daily/claim')),
  history: () => unwrap<Array<{ id: string; dayKey: string; cycleDay: number; coins: number; claimedAt: string }>>(api.get('/rewards/daily/history')),
};
