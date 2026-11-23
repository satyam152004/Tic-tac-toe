import type { Ctx } from '../routes/registry.js';
import * as shop from '../services/emblem.service.js';

export const list = (c: Ctx) => shop.listEmblems(c.userId);
export const unlock = (c: Ctx<unknown, unknown, { id: string }>) => shop.unlockEmblem(c.userId, c.params.id);
export const equip = (c: Ctx<unknown, unknown, { id: string }>) => shop.equipEmblem(c.userId, c.params.id);
