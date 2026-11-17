import { z } from 'zod';
import { BOARD_SIZES, DIFFICULTIES } from '../constants/index.js';

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a digit');

export const username = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[A-Za-z0-9_]+$/, 'Only letters, numbers and underscores');

export const displayName = z.string().trim().min(1).max(40);
export const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const deviceName = z.string().trim().max(100).optional();

export const boardSize = z.union([z.literal(3), z.literal(4), z.literal(5)]).describe(`One of ${BOARD_SIZES.join(', ')}`);
export const winLength = z.number().int().min(3).max(5).optional().describe('Marks in a row needed to win (3..boardSize). Defaults: 3x3=3, 4x4=4, 5x5=4');
export const difficulty = z.enum(DIFFICULTIES);

export const gameConfig = z.object({ boardSize, winLength });

export const idParam = z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id') });
export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
