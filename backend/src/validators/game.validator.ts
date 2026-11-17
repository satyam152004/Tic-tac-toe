import { z } from 'zod';
import { paginationQuery } from '../utils/pagination.js';
import { boardSize, difficulty, objectId, winLength } from './common.js';

export const createGameBody = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('AI'),
    boardSize,
    winLength,
    difficulty,
    humanMark: z.enum(['X', 'O', 'RANDOM']).default('X'),
  }),
  z.object({ type: z.literal('FRIEND'), boardSize, winLength, opponentId: objectId }),
]);

export const moveBody = z.object({
  position: z.number().int().min(0).max(24),
  clientMoveId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/).optional().describe('Idempotency key (UUID). Re-sending returns the original move.'),
  expectedMoveNumber: z.number().int().min(1).max(25).optional().describe('Optional optimistic concurrency check'),
});

export const localMatchesBody = z.object({
  matches: z
    .array(
      z.object({
        clientMatchId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
        size: boardSize,
        winLength: z.number().int().min(3).max(5),
        mode: z.enum(['LOCAL_2P', 'VS_AI']),
        difficulty: difficulty.optional(),
        humanMark: z.enum(['X', 'O']).optional(),
        moves: z.array(z.number().int().min(0).max(24)).min(1).max(25),
        durationMs: z.number().int().min(0).max(86_400_000),
        playedAt: z.string().optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const historyQuery = paginationQuery.extend({
  type: z.enum(['LOCAL', 'AI', 'ONLINE_RANDOM', 'PRIVATE_ROOM', 'FRIEND']).optional(),
  result: z.enum(['WIN', 'LOSS', 'DRAW']).optional(),
});

export const leaderboardQuery = paginationQuery.extend({ metric: z.enum(['points', 'wins']).default('points') });

export type CreateGameBody = z.infer<typeof createGameBody>;
export type MoveBody = z.infer<typeof moveBody>;
