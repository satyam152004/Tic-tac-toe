import { Types } from 'mongoose';
import { NOTIFICATION_CATEGORIES } from '../constants/index.js';
import { logger } from '../config/logger.js';
import { NotificationModel, UserModel } from '../models/index.js';
import { Errors } from '../utils/errors.js';
import { paged, skipOf } from '../utils/pagination.js';
import { addMs } from '../utils/time.js';
import { sendPush } from './push.service.js';
import { realtime } from './realtime.js';

type NotificationType = (typeof import('../constants/index.js'))['NOTIFICATION_TYPES'][number];
type Category = (typeof NOTIFICATION_CATEGORIES)[number];

const CATEGORY_OF: Record<NotificationType, Category> = {
  FRIEND_REQUEST: 'social',
  FRIEND_ACCEPTED: 'social',
  GAME_INVITE: 'game',
  GAME_INVITE_DECLINED: 'game',
  GAME_INVITE_CANCELLED: 'game',
  GAME_INVITE_EXPIRED: 'game',
  MATCH_FOUND: 'game',
  OPPONENT_JOINED: 'game',
  REMATCH_REQUEST: 'game',
  ACHIEVEMENT_UNLOCKED: 'achievements',
  LEVEL_UP: 'achievements',
  ACCOUNT: 'account',
};

const RETENTION_MS = 90 * 24 * 3600 * 1000;

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Persist + deliver a notification.
 *  - history always stored (unless the user disabled the category)
 *  - delivered live over Socket.IO ('notification:new') when the user is connected
 *  - push (FCM) only when the user has NO active socket, so we never double-notify an active user
 */
export async function notify(userId: string | Types.ObjectId, input: NotifyInput): Promise<void> {
  try {
    const category = CATEGORY_OF[input.type];
    const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } }).select('notificationPrefs').lean();
    if (!user) return;
    if (user.notificationPrefs?.[category] === false && input.type !== 'ACCOUNT') return;

    const doc = await NotificationModel.create({
      userId,
      type: input.type,
      category,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      expireAt: addMs(new Date(), RETENTION_MS),
    });
    const json = doc.toJSON();
    const online = await realtime.isUserOnline(userId);
    if (online) {
      realtime.emitToUser(userId, 'notification:new', json);
    } else {
      void sendPush(String(userId), { title: input.title, body: input.body, data: { type: input.type, notificationId: String(doc._id), ...(input.data ?? {}) } });
    }
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'notify failed');
  }
}

export async function listNotifications(userId: string, q: { page: number; limit: number; unreadOnly?: boolean }) {
  const filter: Record<string, unknown> = { userId };
  if (q.unreadOnly) filter.readAt = null;
  const [items, total, unread] = await Promise.all([
    NotificationModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skipOf(q)).limit(q.limit),
    NotificationModel.countDocuments(filter),
    NotificationModel.countDocuments({ userId, readAt: null }),
  ]);
  const res = paged(items.map((n) => n.toJSON()), total, q);
  return { ...res, unread };
}

export async function markRead(userId: string, id: string) {
  const n = await NotificationModel.findOneAndUpdate({ _id: id, userId }, { $set: { readAt: new Date() } }, { new: true });
  if (!n) throw Errors.notFound('Notification not found');
  return n.toJSON();
}

export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const r = await NotificationModel.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
  return { updated: r.modifiedCount };
}

export async function deleteNotification(userId: string, id: string): Promise<void> {
  const r = await NotificationModel.deleteOne({ _id: id, userId });
  if (r.deletedCount === 0) throw Errors.notFound('Notification not found');
}
