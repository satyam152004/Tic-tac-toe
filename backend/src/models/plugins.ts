import { Schema } from 'mongoose';

/** Shared toJSON: expose `id`, hide `_id`/`__v` and anything marked internal. */
export function cleanJson(schema: Schema, hidden: string[] = []): void {
  schema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      for (const h of hidden) delete ret[h];
      return ret;
    },
  });
}

export const DAY_MS = 24 * 60 * 60 * 1000;
