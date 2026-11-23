import { z } from 'zod';
import * as mm from '../matchmaking/matchmaking.service.js';
import type { Ctx } from '../routes/registry.js';
import * as rooms from '../services/room.service.js';
import { idParam } from '../validators/common.js';
import * as v from '../validators/social.validator.js';

type P = z.infer<typeof idParam>;

export const create = (c: Ctx<z.infer<typeof v.roomCreateBody>>) => rooms.create(c.userId, c.body);
export const listOpen = (c: Ctx<unknown, z.infer<typeof v.roomOpenQuery>>) => rooms.listOpen(c.userId, c.query.limit);
export const join = (c: Ctx<z.infer<typeof v.roomJoinBody>>) => rooms.join(c.userId, c.body.code);
export const get = (c: Ctx<unknown, unknown, P>) => rooms.get(c.userId, c.params.id);
export const leave = (c: Ctx<unknown, unknown, P>) => rooms.leave(c.userId, c.params.id);
export const ready = (c: Ctx<z.infer<typeof v.roomReadyBody>, unknown, P>) => rooms.setReady(c.userId, c.params.id, c.body.ready);
export const start = (c: Ctx<unknown, unknown, P>) => rooms.start(c.userId, c.params.id);
export const invite = (c: Ctx<z.infer<typeof v.roomInviteBody>, unknown, P>) => rooms.invite(c.userId, c.params.id, c.body.friendId);

export const mmJoin = (c: Ctx<z.infer<typeof v.matchmakingJoinBody>>) => mm.join(c.userId, c.body);
export const mmCancel = (c: Ctx) => mm.cancel(c.userId);
export const mmStatus = (c: Ctx) => mm.status(c.userId);
