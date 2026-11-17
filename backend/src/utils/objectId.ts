import { Types } from 'mongoose';
import { z } from 'zod';

export const objectIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
export const idParam = z.object({ id: objectIdString });
export const oid = (v: string | Types.ObjectId): Types.ObjectId => new Types.ObjectId(String(v));
export const isOid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);
export const sameId = (a: unknown, b: unknown): boolean => String(a) === String(b);
