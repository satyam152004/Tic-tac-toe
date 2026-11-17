import type { Ctx } from '../routes/registry.js';
import * as rewards from '../services/reward.service.js';

export const status = (c: Ctx) => rewards.getDailyStatus(c.userId);
export const claim = (c: Ctx) => rewards.claimDaily(c.userId);
export const history = (c: Ctx) => rewards.claimHistory(c.userId);
