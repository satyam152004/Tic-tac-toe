import { Types } from 'mongoose';
import { BlockedUserModel, FriendshipDoc, FriendshipModel, GameModel, makePairKey, UserModel } from '../models/index.js';
import { Errors } from '../utils/errors.js';
import { paged, skipOf } from '../utils/pagination.js';
import { audit } from './audit.service.js';
import { notify } from './notification.service.js';
import { CARD_FIELDS, toCard } from './presenter.js';
import { realtime } from './realtime.js';

async function resolveTarget(input: { userId?: string; username?: string }) {
  const user = input.userId
    ? await UserModel.findOne({ _id: input.userId, deletedAt: { $exists: false } }).select('displayName')
    : await UserModel.findOne({ usernameLower: String(input.username).toLowerCase(), deletedAt: { $exists: false } }).select('displayName');
  if (!user) throw Errors.notFound('Player not found', 'USER_NOT_FOUND');
  return user;
}

export async function sendRequest(userId: string, input: { userId?: string; username?: string }) {
  const target = await resolveTarget(input);
  const targetId = String(target._id);
  if (targetId === userId) throw Errors.badRequest('You cannot send a friend request to yourself', 'SELF_REQUEST');

  if (await BlockedUserModel.exists({ blockerId: userId, blockedId: targetId })) throw Errors.forbidden('Unblock this player first', 'BLOCKED');
  // If *they* blocked *me* behave as if the player does not exist (do not leak the block).
  if (await BlockedUserModel.exists({ blockerId: targetId, blockedId: userId })) throw Errors.notFound('Player not found', 'USER_NOT_FOUND');

  const pairKey = makePairKey(userId, targetId);
  const existing = await FriendshipModel.findOne({ pairKey });
  if (existing) {
    if (existing.status === 'ACCEPTED') throw Errors.conflict('Already friends', 'ALREADY_FRIENDS');
    if (String(existing.requesterId) === userId) throw Errors.conflict('Friend request already sent', 'REQUEST_ALREADY_SENT');
    // They already asked me: sending a request back accepts theirs.
    return accept(userId, String(existing._id));
  }
  let doc: FriendshipDoc;
  try {
    doc = await FriendshipModel.create({ requesterId: userId, recipientId: targetId, pairKey, status: 'PENDING' });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw Errors.conflict('Friend request already exists', 'REQUEST_ALREADY_SENT');
    throw err;
  }
  const me = await UserModel.findById(userId).select('displayName').lean();
  await notify(targetId, {
    type: 'FRIEND_REQUEST',
    title: 'New friend request',
    body: `${me?.displayName ?? 'Someone'} wants to be your friend`,
    data: { friendshipId: String(doc._id), fromUserId: userId },
  });
  return { id: String(doc._id), status: 'PENDING' as const, recipientId: targetId };
}

export async function accept(userId: string, friendshipId: string) {
  const f = await FriendshipModel.findOneAndUpdate(
    { _id: friendshipId, recipientId: userId, status: 'PENDING' },
    { $set: { status: 'ACCEPTED', respondedAt: new Date() } },
    { new: true },
  );
  if (!f) throw Errors.notFound('Friend request not found', 'REQUEST_NOT_FOUND');
  const me = await UserModel.findById(userId).select('displayName').lean();
  await notify(f.requesterId, {
    type: 'FRIEND_ACCEPTED',
    title: 'Friend request accepted',
    body: `${me?.displayName ?? 'A player'} accepted your friend request`,
    data: { friendId: userId },
  });
  return { id: String(f._id), status: 'ACCEPTED' as const, friendId: String(f.requesterId) };
}

export async function reject(userId: string, friendshipId: string): Promise<void> {
  const r = await FriendshipModel.deleteOne({ _id: friendshipId, recipientId: userId, status: 'PENDING' });
  if (r.deletedCount === 0) throw Errors.notFound('Friend request not found', 'REQUEST_NOT_FOUND');
}

/** Removes a friendship (ACCEPTED) or cancels an outgoing request (PENDING sent by me). */
export async function remove(userId: string, friendshipId: string): Promise<void> {
  const uid = new Types.ObjectId(userId);
  const r = await FriendshipModel.deleteOne({
    _id: friendshipId,
    $or: [{ status: 'ACCEPTED', $or: [{ requesterId: uid }, { recipientId: uid }] }, { status: 'PENDING', requesterId: uid }],
  });
  if (r.deletedCount === 0) throw Errors.notFound('Friendship not found', 'FRIENDSHIP_NOT_FOUND');
}

export async function list(userId: string, q: { page: number; limit: number; status: 'accepted' | 'incoming' | 'outgoing' }) {
  const uid = new Types.ObjectId(userId);
  const filter =
    q.status === 'accepted'
      ? { status: 'ACCEPTED', $or: [{ requesterId: uid }, { recipientId: uid }] }
      : q.status === 'incoming'
        ? { status: 'PENDING', recipientId: uid }
        : { status: 'PENDING', requesterId: uid };
  const [rows, total] = await Promise.all([
    FriendshipModel.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skipOf(q)).limit(q.limit).lean(),
    FriendshipModel.countDocuments(filter),
  ]);
  const otherIds = rows.map((r) => (String(r.requesterId) === userId ? r.recipientId : r.requesterId));
  const users = await UserModel.find({ _id: { $in: otherIds }, deletedAt: { $exists: false } }).select(CARD_FIELDS).lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  // Friends currently in a live online game that may be watched (drives the "Spectate" action).
  const live = new Map<string, string>();
  if (q.status === 'accepted' && otherIds.length) {
    const [games, privacy] = await Promise.all([
      GameModel.find({ playerIds: { $in: otherIds }, type: { $in: ['ONLINE_RANDOM', 'PRIVATE_ROOM', 'FRIEND'] }, status: 'IN_PROGRESS' }).select('_id playerIds').lean(),
      UserModel.find({ _id: { $in: otherIds }, 'privacy.allowSpectating': false }).select('_id').lean(),
    ]);
    const hidden = new Set(privacy.map((u) => String(u._id)));
    for (const g of games) for (const pid of g.playerIds) if (!hidden.has(String(pid)) && otherIds.some((o) => String(o) === String(pid))) live.set(String(pid), String(g._id));
  }
  const items = rows
    .map((r) => {
      const otherId = String(String(r.requesterId) === userId ? r.recipientId : r.requesterId);
      const u = byId.get(otherId);
      return u ? { friendshipId: String(r._id), status: r.status, since: r.respondedAt ?? null, requestedAt: (r as { createdAt?: Date }).createdAt, user: { ...toCard(u), lastActiveAt: u.lastActiveAt }, ...(q.status === 'accepted' ? { activeGameId: live.get(otherId) ?? null } : {}) } : null;
    })
    .filter(Boolean);
  return paged(items, total, q);
}

export async function block(userId: string, targetId: string) {
  if (targetId === userId) throw Errors.badRequest('You cannot block yourself', 'SELF_BLOCK');
  if (!(await UserModel.exists({ _id: targetId, deletedAt: { $exists: false } }))) throw Errors.notFound('Player not found', 'USER_NOT_FOUND');
  await BlockedUserModel.updateOne({ blockerId: userId, blockedId: targetId }, { $setOnInsert: { blockerId: userId, blockedId: targetId } }, { upsert: true });
  await FriendshipModel.deleteOne({ pairKey: makePairKey(userId, targetId) });
  audit('friends.block', { userId, meta: { targetId } });
  realtime.emitToUser(userId, 'friends:updated', { blockedId: targetId });
  return { blocked: true };
}

export async function unblock(userId: string, targetId: string) {
  const r = await BlockedUserModel.deleteOne({ blockerId: userId, blockedId: targetId });
  if (r.deletedCount === 0) throw Errors.notFound('Player is not blocked', 'NOT_BLOCKED');
  return { blocked: false };
}

export async function listBlocked(userId: string, q: { page: number; limit: number }) {
  const [rows, total] = await Promise.all([
    BlockedUserModel.find({ blockerId: userId }).sort({ createdAt: -1 }).skip(skipOf(q)).limit(q.limit).lean(),
    BlockedUserModel.countDocuments({ blockerId: userId }),
  ]);
  const users = await UserModel.find({ _id: { $in: rows.map((r) => r.blockedId) } }).select(CARD_FIELDS).lean();
  return paged(users.map(toCard), total, q);
}
