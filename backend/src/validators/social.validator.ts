import { z } from 'zod';
import { paginationQuery } from '../utils/pagination.js';
import { boardSize, entryAmount, firstMove, objectId, username, winLength } from './common.js';

export const matchmakingJoinBody = z.object({ boardSize: boardSize.default(3), winLength, firstMove, entryAmount });
export const roomCreateBody = z.object({
  boardSize: boardSize.default(3),
  winLength,
  firstMove,
  isPublic: z.boolean().default(false).describe('List the room in GET /rooms/open while it waits for a guest (default: private, code only)'),
  turnTimeoutSec: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(60)]).optional().describe('Per-turn clock in seconds, 0 = off (default: server turn timeout)'),
  entryAmount: z
    .union([z.literal(0), z.literal(10), z.literal(25), z.literal(50)])
    .default(0)
    .describe('Coins each player pays when the match starts (0 = free). The winner takes both entries; a draw or an abandoned match refunds them.'),
});
export const roomOpenQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) });
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
