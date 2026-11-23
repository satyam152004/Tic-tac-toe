import { model, Schema } from 'mongoose';
import { cleanJson } from './plugins.js';

// ---------------- Device tokens (FCM) ----------------
const deviceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, maxlength: 4096 },
    platform: { type: String, enum: ['android', 'ios'], required: true },
    deviceName: { type: String, maxlength: 100 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
deviceSchema.index({ token: 1 }, { unique: true });
deviceSchema.index({ userId: 1 });
// Retention: tokens not refreshed for 90 days are dropped (FCM tokens go stale).
deviceSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
cleanJson(deviceSchema, ['token']);
export const DeviceTokenModel = model('DeviceToken', deviceSchema);

// ---------------- Reports ----------------
const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportedId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game' },
    reason: { type: String, enum: ['CHEATING', 'ABUSE', 'STALLING', 'SPAM', 'INAPPROPRIATE_NAME', 'OTHER'], required: true },
    details: { type: String, maxlength: 1000 },
    status: { type: String, enum: ['OPEN', 'REVIEWED', 'DISMISSED'], default: 'OPEN' },
  },
  { timestamps: true },
);
reportSchema.index({ reportedId: 1, status: 1 });
reportSchema.index({ reporterId: 1, reportedId: 1, createdAt: -1 });
cleanJson(reportSchema);
export const ReportModel = model('Report', reportSchema);

// ---------------- Audit log ----------------
const auditSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    ip: { type: String },
    meta: { type: Schema.Types.Mixed },
    expireAt: { type: Date, required: true }, // retention: 180 days
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditSchema.index({ userId: 1, createdAt: -1 });
auditSchema.index({ action: 1, createdAt: -1 });
auditSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
cleanJson(auditSchema);
export const AuditLogModel = model('AuditLog', auditSchema);

// ---------------- Daily reward claim history ----------------
const rewardClaimSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dayKey: { type: String, required: true }, // user's local calendar day (YYYY-MM-DD in `timezone`)
    cycleDay: { type: Number, required: true, min: 1, max: 7 },
    coins: { type: Number, required: true, min: 1 },
    timezone: { type: String, required: true },
    claimedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);
// One claim per user per local day, enforced by the database (a second concurrent claim fails with E11000).
rewardClaimSchema.index({ userId: 1, dayKey: 1 }, { unique: true });
rewardClaimSchema.index({ userId: 1, claimedAt: -1 });
// Retention: claim history is kept for 400 days.
rewardClaimSchema.index({ claimedAt: 1 }, { expireAfterSeconds: 400 * 24 * 3600 });
cleanJson(rewardClaimSchema);
export const RewardClaimModel = model('RewardClaim', rewardClaimSchema);
