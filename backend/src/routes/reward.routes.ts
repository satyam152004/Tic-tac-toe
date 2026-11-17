import * as c from '../controllers/reward.controller.js';
import { route } from './registry.js';

const tag = 'Rewards';

export const rewardRoutes = [
  route({ method: 'get', path: '/rewards/daily', tag, summary: 'Daily reward status: 7-day cycle, which day is claimable, my coin balance', response: '{ timezone, canClaim, claimedToday, nextDay, streak, nextClaimAt, coins, cycle[{ day, coins, status }] }', handler: c.status }),
  route({ method: 'post', path: '/rewards/daily/claim', tag, summary: 'Claim the daily reward (amount decided by the server; one claim per local day)', response: '{ claimed: { day, coins }, wallet: { coins }, status }', errors: ['REWARD_ALREADY_CLAIMED'], handler: c.claim }),
  route({ method: 'get', path: '/rewards/daily/history', tag, summary: 'My most recent daily reward claims', response: 'Array of { id, dayKey, cycleDay, coins, claimedAt }', handler: c.history }),
];
