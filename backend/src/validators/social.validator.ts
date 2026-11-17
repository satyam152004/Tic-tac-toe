import { z } from 'zod';
import { paginationQuery } from '../utils/pagination.js';
import { boardSize, objectId, username, winLength } from './common.js';

export const matchmakingJoinBody = z.object({ boardSize: boardSize.default(3), winLength });
export const roomCreateBody = z.object({ boardSize: boardSize.default(3), winLength });
export const roomJoinBody = z.object({ code: z.string().trim().length(6).regex(/^[A-Za-z0-9]+$/) });
export const roomReadyBody = z.object({ ready: z.boolean() });
export const roomInviteBody = z.object({ friendId: objectId });

export const friendRequestBody = z
  .object({ userId: objectId.optional(), username: username.optional() })
  .refine((v) => Boolean(v.userId) !== Boolean(v.username), 'Provide exactly one of userId or username');

export const friendListQuery = paginationQuery.extend({ status: z.enum(['accepted', 'incoming', 'outgoing']).default('accepted') });

export const notificationsQuery = paginationQuery.extend({
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
});
