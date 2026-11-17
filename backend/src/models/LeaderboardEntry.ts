import { model, Schema } from 'mongoose';
import { LEADERBOARD_PERIODS } from '../constants/index.js';
import { cleanJson } from './plugins.js';

/**
 * Per-period scoreboard rows (daily/weekly/monthly). Only written by the match finalizer.
 * The all-time boards read straight from users.stats.* (single source of truth, no duplication).
 */
const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    period: { type: String, enum: LEADERBOARD_PERIODS, required: true },
    periodKey: { type: String, required: true }, // 2026-11-17 | 2026-W47 | 2026-11
    points: { type: Number, default: 0, min: 0 },
    wins: { type: Number, default: 0, min: 0 },
    games: { type: Number, default: 0, min: 0 },
    expireAt: { type: Date, required: true },
  },
  { timestamps: true },
);
schema.index({ period: 1, periodKey: 1, userId: 1 }, { unique: true });
schema.index({ period: 1, periodKey: 1, points: -1, _id: 1 });
schema.index({ period: 1, periodKey: 1, wins: -1, _id: 1 });
schema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
cleanJson(schema, ['expireAt']);

export const LeaderboardEntryModel = model('LeaderboardEntry', schema);
