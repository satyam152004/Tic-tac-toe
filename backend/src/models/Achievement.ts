import { model, Schema } from 'mongoose';
import { cleanJson } from './plugins.js';

/** Achievement catalogue (seeded/upserted at startup from services/achievement.definitions). */
const achievementSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    /** Which player statistic drives progress (see achievement.service METRICS). */
    metric: { type: String, required: true },
    target: { type: Number, required: true, min: 1 },
    reward: {
      xp: { type: Number, default: 0, min: 0 },
      points: { type: Number, default: 0, min: 0 },
    },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);
cleanJson(achievementSchema);
export const AchievementModel = model('Achievement', achievementSchema);

const userAchievementSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    achievementKey: { type: String, required: true },
    progress: { type: Number, default: 0, min: 0 },
    unlockedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
userAchievementSchema.index({ userId: 1, achievementKey: 1 }, { unique: true });
userAchievementSchema.index({ userId: 1, unlockedAt: -1 });
cleanJson(userAchievementSchema);
export const UserAchievementModel = model('UserAchievement', userAchievementSchema);
