import { HydratedDocument, InferSchemaType, model, Schema } from 'mongoose';
import { ACCOUNT_TYPES, AUTH_PROVIDERS, THEMES } from '../constants/index.js';
import { cleanJson } from './plugins.js';

const statsSchema = new Schema(
  {
    totalGames: { type: Number, default: 0, min: 0 },
    wins: { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },
    draws: { type: Number, default: 0, min: 0 },
    points: { type: Number, default: 0, min: 0 },
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    currentStreak: { type: Number, default: 0, min: 0 },
    bestStreak: { type: Number, default: 0, min: 0 },
    totalPlayTimeSec: { type: Number, default: 0, min: 0 },
    aiGames: { type: Number, default: 0, min: 0 },
    aiWins: { type: Number, default: 0, min: 0 },
    onlineGames: { type: Number, default: 0, min: 0 },
    onlineWins: { type: Number, default: 0, min: 0 },
    privateRoomWins: { type: Number, default: 0, min: 0 },
    perfectGames: { type: Number, default: 0, min: 0 },
    expertAiWins: { type: Number, default: 0, min: 0 },
    // Verified-by-replay offline games uploaded by the client. Never affect points/leaderboards.
    localGames: { type: Number, default: 0, min: 0 },
    localWins: { type: Number, default: 0, min: 0 },
    localLosses: { type: Number, default: 0, min: 0 },
    localDraws: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

/** One-time code state. Only an HMAC of the code is stored, never the code itself. */
const otpSchema = new Schema(
  {
    hash: { type: String },
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date },
    windowStart: { type: Date },
    windowCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 20, match: /^[A-Za-z0-9_]+$/ },
    usernameLower: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    emailVerified: { type: Boolean, default: false },
    passwordHash: { type: String, select: false },
    accountType: { type: String, enum: ACCOUNT_TYPES, required: true, default: 'GUEST' },
    providers: {
      type: [
        new Schema(
          { provider: { type: String, enum: AUTH_PROVIDERS, required: true }, subject: { type: String, required: true } },
          { _id: false },
        ),
      ],
      default: [],
    },
    avatar: { type: String, default: 'avatar_default', maxlength: 300 },
    bio: { type: String, default: '', maxlength: 160 },
    // IANA zone used to decide the user's local day for daily rewards. Changes are rate limited (see reward.service).
    timezone: { type: String, default: 'UTC', maxlength: 64 },
    timezoneChangedAt: { type: Date },
    wallet: { coins: { type: Number, default: 0, min: 0 } },
    // Daily reward state: last claimed local day (YYYY-MM-DD in `timezone`) and its cycle day (1..7).
    daily: { lastKey: { type: String }, day: { type: Number, min: 1, max: 7 }, lastClaimAt: { type: Date } },
    theme: { type: String, enum: THEMES, default: 'light' },
    sound: {
      effects: { type: Boolean, default: true },
      music: { type: Boolean, default: true },
      volume: { type: Number, min: 0, max: 1, default: 0.8 },
    },
    language: { type: String, default: 'en', maxlength: 10 },
    notificationPrefs: {
      social: { type: Boolean, default: true },
      game: { type: Boolean, default: true },
      achievements: { type: Boolean, default: true },
      account: { type: Boolean, default: true },
    },
    // Privacy: whether accepted friends may watch this player's live online games.
    privacy: { allowSpectating: { type: Boolean, default: true } },
    stats: { type: statsSchema, default: () => ({}) },
    online: { type: Boolean, default: false },
    lastActiveAt: { type: Date, default: Date.now },
    deletedAt: { type: Date },
    emailOtp: { type: otpSchema, select: false },
    resetOtp: { type: otpSchema, select: false },
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyExpiresAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  { timestamps: true },
);

// Unique only for real emails (guests / deleted users have none).
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
userSchema.index(
  { 'providers.provider': 1, 'providers.subject': 1 },
  { unique: true, partialFilterExpression: { 'providers.subject': { $type: 'string' } } },
);
userSchema.index({ 'stats.points': -1, _id: 1 });
userSchema.index({ 'stats.wins': -1, _id: 1 });
userSchema.index({ online: 1, lastActiveAt: 1 });
userSchema.index({ accountType: 1, lastActiveAt: 1 });

cleanJson(userSchema, [
  'passwordHash',
  'usernameLower',
  'providers',
  'emailVerifyTokenHash',
  'emailVerifyExpiresAt',
  'passwordResetTokenHash',
  'passwordResetExpiresAt',
  'emailOtp',
  'resetOtp',
]);

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserAttrs>;
export const UserModel = model('User', userSchema);
