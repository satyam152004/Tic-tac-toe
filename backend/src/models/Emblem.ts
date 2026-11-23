import { model, Schema } from 'mongoose';
import { cleanJson } from './plugins.js';

/** Emblems a user bought (free ones are implicit) and the one currently shown on their profile. */
const userEmblemsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    unlocked: { type: [String], default: [] },
    equipped: { type: String, default: 'cobalt' },
  },
  { timestamps: true },
);
userEmblemsSchema.index({ userId: 1 }, { unique: true });
cleanJson(userEmblemsSchema);
export const UserEmblemsModel = model('UserEmblems', userEmblemsSchema);
