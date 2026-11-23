import { Types } from 'mongoose';
import {
  BlockedUserModel,
  DeviceTokenModel,
  FriendshipModel,
  NotificationModel,
  RefreshTokenModel,
  ReportModel,
  UserModel,
} from '../models/index.js';
import { Errors } from '../utils/errors.js';
import { paged, skipOf } from '../utils/pagination.js';
import { audit } from './audit.service.js';
import { verifyPassword } from './auth.service.js';
import { toPublic, toSelf } from './presenter.js';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function getMe(userId: string) {
  const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } }).lean();
  if (!user) throw Errors.notFound('User not found');
  return toSelf(user);
}

export interface UpdateMeInput {
  username?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  timezone?: string;
  theme?: string;
  language?: string;
  sound?: { effects?: boolean; music?: boolean; volume?: number };
  notificationPrefs?: { social?: boolean; game?: boolean; achievements?: boolean };
  privacy?: { allowSpectating?: boolean };
}

export async function updateMe(userId: string, input: UpdateMeInput) {
  const set: Record<string, unknown> = {};
  if (input.displayName !== undefined) set.displayName = input.displayName;
  if (input.avatar !== undefined) set.avatar = input.avatar;
  if (input.bio !== undefined) set.bio = input.bio;
  if (input.theme !== undefined) set.theme = input.theme;
  if (input.language !== undefined) set.language = input.language;
  for (const [k, v] of Object.entries(input.sound ?? {})) set[`sound.${k}`] = v;
  for (const [k, v] of Object.entries(input.notificationPrefs ?? {})) set[`notificationPrefs.${k}`] = v;
  for (const [k, v] of Object.entries(input.privacy ?? {})) set[`privacy.${k}`] = v;
  if (input.timezone !== undefined) {
    // Daily rewards follow the user's local day, so switching zones is limited (stops claiming twice by hopping zones).
    const cur = await UserModel.findById(userId).select('timezone timezoneChangedAt').lean();
    if (cur && cur.timezone !== input.timezone) {
      if (cur.timezoneChangedAt && Date.now() - cur.timezoneChangedAt.getTime() < 7 * 24 * 3600_000) {
        throw Errors.conflict('The time zone can be changed once every 7 days', 'TIMEZONE_CHANGE_LIMITED');
      }
      set.timezone = input.timezone;
      set.timezoneChangedAt = new Date();
    }
  }
  if (input.username !== undefined) {
    const lower = input.username.toLowerCase();
    if (await UserModel.exists({ usernameLower: lower, _id: { $ne: userId } })) throw Errors.conflict('Username is already taken', 'USERNAME_TAKEN');
    set.username = input.username;
    set.usernameLower = lower;
  }
  try {
    const user = await UserModel.findOneAndUpdate({ _id: userId, deletedAt: { $exists: false } }, { $set: set }, { new: true, runValidators: true }).lean();
    if (!user) throw Errors.notFound('User not found');
    return toSelf(user);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw Errors.conflict('Username is already taken', 'USERNAME_TAKEN');
    throw err;
  }
}

export async function getPublicProfile(viewerId: string, id: string) {
  const user = await UserModel.findOne({ _id: id, deletedAt: { $exists: false } }).lean();
  if (!user) throw Errors.notFound('User not found');
  if (String(user._id) !== viewerId) {
    const blocked = await BlockedUserModel.exists({ blockerId: user._id, blockedId: viewerId });
    if (blocked) throw Errors.notFound('User not found');
  }
  return toPublic(user);
}

export async function searchUsers(viewerId: string, q: { q: string; page: number; limit: number }) {
  const blockedBy = await BlockedUserModel.find({ blockedId: viewerId }).distinct('blockerId');
  const blocking = await BlockedUserModel.find({ blockerId: viewerId }).distinct('blockedId');
  const filter = {
    deletedAt: { $exists: false },
    _id: { $nin: [new Types.ObjectId(viewerId), ...blockedBy, ...blocking] },
    // Prefix search on the indexed lower-cased username (escaped => no regex injection).
    usernameLower: { $regex: `^${escapeRegex(q.q.toLowerCase())}` },
  };
  const [items, total] = await Promise.all([
    UserModel.find(filter).sort({ usernameLower: 1 }).skip(skipOf(q)).limit(q.limit).lean(),
    UserModel.countDocuments(filter),
  ]);
  return paged(items.map(toPublic), total, q);
}

/** Deletes the account: PII removed, credentials/tokens/social data dropped, finished games stay (anonymised). */
export async function deleteAccount(userId: string, password: string | undefined, ip?: string) {
  const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } }).select('+passwordHash');
  if (!user) throw Errors.notFound('User not found');
  if (user.accountType === 'REGISTERED' && user.passwordHash) {
    if (!password || !(await verifyPassword(password, user.passwordHash))) throw Errors.unauthorized('Password confirmation failed', 'INVALID_CREDENTIALS');
  }
  const id = user._id;
  await Promise.all([
    RefreshTokenModel.deleteMany({ userId: id }),
    DeviceTokenModel.deleteMany({ userId: id }),
    NotificationModel.deleteMany({ userId: id }),
    FriendshipModel.deleteMany({ $or: [{ requesterId: id }, { recipientId: id }] }),
    BlockedUserModel.deleteMany({ blockerId: id }),
  ]);
  await UserModel.updateOne(
    { _id: id },
    {
      $set: {
        deletedAt: new Date(),
        username: `deleted_${String(id).slice(-8)}`,
        usernameLower: `deleted_${String(id)}`,
        displayName: 'Deleted Player',
        avatar: 'avatar_default',
        online: false,
        providers: [],
      },
      $unset: { email: 1, passwordHash: 1, emailVerifyTokenHash: 1, passwordResetTokenHash: 1 },
    },
  );
  audit('user.deleted', { userId: id, ip });
}

export async function reportUser(reporterId: string, reportedId: string, input: { reason: string; details?: string; gameId?: string }) {
  if (reporterId === reportedId) throw Errors.badRequest('You cannot report yourself', 'SELF_REPORT');
  if (!(await UserModel.exists({ _id: reportedId, deletedAt: { $exists: false } }))) throw Errors.notFound('User not found');
  const recent = await ReportModel.countDocuments({ reporterId, reportedId, createdAt: { $gt: new Date(Date.now() - 24 * 3600_000) } });
  if (recent >= 3) throw Errors.tooMany('You already reported this user recently', 'REPORT_LIMIT');
  const r = await ReportModel.create({ reporterId, reportedId, ...input });
  audit('user.reported', { userId: reporterId, meta: { reportedId, reason: input.reason } });
  return r.toJSON();
}

/** Device token management (FCM). */
export async function registerDevice(userId: string, input: { token: string; platform: 'android' | 'ios'; deviceName?: string }) {
  // The same physical token may previously have belonged to another account on this device.
  const d = await DeviceTokenModel.findOneAndUpdate(
    { token: input.token },
    { $set: { userId, platform: input.platform, deviceName: input.deviceName, lastSeenAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return d.toJSON();
}

export async function removeDevice(userId: string, id: string) {
  const r = await DeviceTokenModel.deleteOne({ _id: id, userId });
  if (r.deletedCount === 0) throw Errors.notFound('Device not found');
}
