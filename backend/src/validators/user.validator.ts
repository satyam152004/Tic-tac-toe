import { z } from 'zod';
import { THEMES } from '../constants/index.js';
import { paginationQuery } from '../utils/pagination.js';
import { displayName, username } from './common.js';

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const updateMeBody = z
  .object({
    username: username.optional(),
    displayName: displayName.optional(),
    avatar: z
      .string()
      .regex(/^(avatar_[a-z0-9_]{1,40}|https:\/\/[^\s]{1,280})$/, 'Use an avatar_* preset id or an https URL')
      .optional(),
    bio: z.string().trim().max(160).optional(),
    timezone: z.string().max(64).refine(isTimeZone, 'Unknown IANA time zone').optional(),
    theme: z.enum(THEMES).optional(),
    language: z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/).optional(),
    sound: z.object({ effects: z.boolean().optional(), music: z.boolean().optional(), volume: z.number().min(0).max(1).optional() }).strict().optional(),
    notificationPrefs: z.object({ social: z.boolean().optional(), game: z.boolean().optional(), achievements: z.boolean().optional() }).strict().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');

export const deleteMeBody = z.object({ password: z.string().max(128).optional() });

export const searchQuery = paginationQuery.extend({ q: z.string().trim().min(2).max(20) });

export const reportBody = z.object({
  reason: z.enum(['CHEATING', 'ABUSE', 'SPAM', 'INAPPROPRIATE_NAME', 'OTHER']),
  details: z.string().trim().max(1000).optional(),
  gameId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

export const registerDeviceBody = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(['android', 'ios']),
  deviceName: z.string().trim().max(100).optional(),
});

export type UpdateMeBody = z.infer<typeof updateMeBody>;
