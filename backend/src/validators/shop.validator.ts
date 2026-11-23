import { z } from 'zod';
import { EMBLEM_IDS } from '../services/emblem.service.js';

export const emblemParam = z.object({ id: z.enum(EMBLEM_IDS) });
