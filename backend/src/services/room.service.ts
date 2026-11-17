import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { FriendshipModel, makePairKey, RoomDoc, RoomModel, UserModel } from '../models/index.js';
import { randomRoomCode } from '../utils/crypto.js';
import { Errors } from '../utils/errors.js';
import { addMs, DAY_MS } from '../utils/time.js';
import { areBlocked, assertNoActiveOnlineGame, createGameDoc, forfeit, presentGame, randomMark, resolveConfig } from './game.service.js';
import { notify } from './notification.service.js';
import { CARD_FIELDS, toCard } from './presenter.js';
import { realtime } from './realtime.js';
import { otherMark } from '../game-engine/index.js';

const LIVE = ['WAITING', 'FULL', 'READY', 'PLAYING'] as const;

async function presentRoom(room: RoomDoc | (Record<string, unknown> & { _id: Types.ObjectId })) {
  const r = 'toObject' in room ? (room as RoomDoc).toObject() : (room as unknown as RoomDoc);
  const ids = [r.hostId, r.guestId].filter(Boolean) as Types.ObjectId[];
  const users = await UserModel.find({ _id: { $in: ids } }).select(CARD_FIELDS).lean();
  const card = (id?: Types.ObjectId | null) => {
    const u = id ? users.find((x) => String(x._id) === String(id)) : undefined;
    return u ? toCard(u) : null;
  };
  return {
    id: String(r._id),
    code: r.code,
    status: r.status,
    host: card(r.hostId),
    guest: card(r.guestId),
    hostId: String(r.hostId),
    guestId: r.guestId ? String(r.guestId) : null,
    boardSize: r.boardSize,
    winLength: r.winLength,
    guestReady: r.guestReady,
    gameId: r.gameId ? String(r.gameId) : null,
    expiresAt: r.expiresAt,
    createdAt: (r as { createdAt?: Date }).createdAt,
  };
}

const isMember = (r: RoomDoc, userId: string) => String(r.hostId) === userId || (r.guestId ? String(r.guestId) === userId : false);

async function loadRoom(id: string): Promise<RoomDoc> {
  const r = await RoomModel.findById(id);
  if (!r) throw Errors.notFound('Room not found', 'ROOM_NOT_FOUND');
  return r;
}

async function loadMemberRoom(userId: string, id: string): Promise<RoomDoc> {
  const r = await loadRoom(id);
  if (!isMember(r, userId)) throw Errors.forbidden('You are not in this room', 'NOT_IN_ROOM');
  return r;
}

async function assertNotInLiveRoom(userId: string): Promise<void> {
  const r = await RoomModel.findOne({ $or: [{ hostId: userId }, { guestId: userId }], status: { $in: LIVE }, expiresAt: { $gt: new Date() } }).select('_id').lean();
  if (r) throw Errors.conflict('You are already in a room', 'ALREADY_IN_ROOM', { roomId: String(r._id) });
}

async function broadcast(room: RoomDoc, event = 'room:updated') {
  realtime.emitToRoom(room._id, event, { room: await presentRoom(room) });
}

export async function create(userId: string, input: { boardSize: number; winLength?: number }) {
  const config = resolveConfig(input.boardSize, input.winLength);
  await assertNotInLiveRoom(userId);
  await assertNoActiveOnlineGame(userId);
  const now = new Date();
  const expiresAt = addMs(now, env.ROOM_TTL_MIN * 60_000);
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const room = await RoomModel.create({
        code: randomRoomCode(),
        hostId: userId,
        boardSize: config.size,
        winLength: config.winLength,
        status: 'WAITING',
        expiresAt,
        purgeAt: addMs(expiresAt, 7 * DAY_MS),
      });
      realtime.joinUserTo(userId, `room:${room._id}`);
      const payload = { room: await presentRoom(room) };
      realtime.emitToUser(userId, 'room:created', payload);
      return payload.room;
    } catch (err) {
      if ((err as { code?: number; keyPattern?: Record<string, unknown> }).code === 11000 && (err as { keyPattern?: Record<string, unknown> }).keyPattern?.code) continue;
      throw err;
    }
  }
  throw Errors.internal('Could not allocate a room code');
}

export async function join(userId: string, code: string) {
  const normalized = code.trim().toUpperCase();
  const now = new Date();
  const probe = await RoomModel.findOne({ code: normalized });
  if (!probe) throw Errors.notFound('Room not found', 'ROOM_NOT_FOUND');
  if (String(probe.hostId) === userId || (probe.guestId && String(probe.guestId) === userId)) {
    realtime.joinUserTo(userId, `room:${probe._id}`);
    return presentRoom(probe); // re-joining your own room is idempotent
  }
  if (probe.status === 'EXPIRED' || probe.expiresAt <= now) throw new (await import('../utils/errors.js')).AppError(410, 'ROOM_EXPIRED', 'Room has expired');
  if (await areBlocked(userId, probe.hostId)) throw Errors.forbidden('You cannot join this room', 'BLOCKED');
  await assertNotInLiveRoom(userId);
  await assertNoActiveOnlineGame(userId);

  // Capacity is enforced atomically: only one joiner can fill the second seat.
  const room = await RoomModel.findOneAndUpdate(
    { _id: probe._id, status: 'WAITING', guestId: null, expiresAt: { $gt: now } },
    { $set: { guestId: userId, status: 'FULL', guestReady: false } },
    { new: true },
  );
  if (!room) throw Errors.conflict('Room is full or not accepting players', 'ROOM_FULL');
  realtime.joinUserTo(userId, `room:${room._id}`);
  await broadcast(room);
  const joiner = await UserModel.findById(userId).select('displayName').lean();
  await notify(room.hostId, { type: 'OPPONENT_JOINED', title: 'Player joined', body: `${joiner?.displayName ?? 'A player'} joined your room`, data: { roomId: String(room._id) } });
  return presentRoom(room);
}

export async function get(userId: string, id: string) {
  const r = await loadRoom(id);
  const invited = r.invitedUserIds.some((x) => String(x) === userId);
  if (!isMember(r, userId) && !invited) throw Errors.forbidden('You are not in this room', 'NOT_IN_ROOM');
  return presentRoom(r);
}

/** Guest toggles readiness (the host is implicitly ready). FULL <-> READY. */
export async function setReady(userId: string, id: string, ready: boolean) {
  const r = await loadMemberRoom(userId, id);
  if (String(r.hostId) === userId) throw Errors.badRequest('The host is always ready', 'HOST_ALWAYS_READY');
  const room = await RoomModel.findOneAndUpdate(
    { _id: r._id, guestId: userId, status: { $in: ['FULL', 'READY'] } },
    { $set: { guestReady: ready, status: ready ? 'READY' : 'FULL' } },
    { new: true },
  );
  if (!room) throw Errors.conflict('Room is not in a state where readiness can change', 'ROOM_STATE');
  await broadcast(room);
  return presentRoom(room);
}

export async function start(userId: string, id: string) {
  const r = await loadMemberRoom(userId, id);
  if (String(r.hostId) !== userId) throw Errors.forbidden('Only the host can start the game', 'NOT_HOST');
  if (r.status === 'PLAYING') throw Errors.conflict('Game already started', 'ROOM_STATE');
  // Atomic claim READY -> PLAYING so a double tap cannot create two games.
  const claimed = await RoomModel.findOneAndUpdate({ _id: r._id, hostId: userId, status: { $in: ['READY', 'COMPLETED'] }, guestId: { $ne: null }, expiresAt: { $gt: new Date() } }, { $set: { status: 'PLAYING' } }, { new: true });
  if (!claimed) throw Errors.conflict('Both players must be present and ready', 'ROOM_NOT_READY');
  try {
    const mark = randomMark();
    const game = await createGameDoc({
      type: 'PRIVATE_ROOM',
      config: { size: claimed.boardSize as 3 | 4 | 5, winLength: claimed.winLength },
      humans: [
        { userId: claimed.hostId, mark },
        { userId: claimed.guestId!, mark: otherMark(mark) },
      ],
      status: 'READY',
      roomId: claimed._id,
      createdBy: claimed.hostId,
    });
    claimed.gameId = game._id;
    await claimed.save();
    for (const uid of [claimed.hostId, claimed.guestId!]) realtime.joinUserTo(uid, `game:${game._id}`);
    await broadcast(claimed);
    return { room: await presentRoom(claimed), game: presentGame(game) };
  } catch (err) {
    await RoomModel.updateOne({ _id: r._id }, { $set: { status: r.status } });
    throw err;
  }
}

export async function leave(userId: string, id: string) {
  const room = await loadMemberRoom(userId, id);
  if (room.status === 'PLAYING' && room.gameId) {
    // Leaving a running game forfeits it.
    await forfeit(userId, String(room.gameId)).catch(() => undefined);
  }
  const fresh = await loadRoom(id);
  const isHost = String(fresh.hostId) === userId;
  if (isHost && fresh.guestId) {
    // Host management: the guest is promoted to host.
    fresh.hostId = fresh.guestId;
    fresh.guestId = null;
    fresh.guestReady = false;
    fresh.status = 'WAITING';
    fresh.gameId = null;
  } else if (isHost) {
    fresh.status = 'EXPIRED'; // room cancelled by its last member
    fresh.expiresAt = new Date();
  } else {
    fresh.guestId = null;
    fresh.guestReady = false;
    fresh.status = 'WAITING';
    fresh.gameId = null;
  }
  await fresh.save();
  realtime.leaveUserFrom(userId, `room:${fresh._id}`);
  if (fresh.status === 'EXPIRED') realtime.emitToRoom(fresh._id, 'room:expired', { roomId: String(fresh._id), reason: 'CANCELLED' });
  else await broadcast(fresh);
  return presentRoom(fresh);
}

export async function invite(userId: string, id: string, friendId: string) {
  const room = await loadMemberRoom(userId, id);
  if (room.status !== 'WAITING') throw Errors.conflict('Room is not accepting players', 'ROOM_FULL');
  if (friendId === userId) throw Errors.badRequest('You cannot invite yourself', 'SELF_INVITE');
  const friends = await FriendshipModel.exists({ pairKey: makePairKey(userId, friendId), status: 'ACCEPTED' });
  if (!friends) throw Errors.forbidden('You can only invite friends', 'NOT_FRIENDS');
  if (await areBlocked(userId, friendId)) throw Errors.forbidden('Not allowed', 'BLOCKED');
  await RoomModel.updateOne({ _id: room._id }, { $addToSet: { invitedUserIds: new Types.ObjectId(friendId) } });
  const me = await UserModel.findById(userId).select('displayName').lean();
  await notify(friendId, {
    type: 'GAME_INVITE',
    title: 'Game invitation',
    body: `${me?.displayName ?? 'A friend'} invited you to a private room`,
    data: { roomId: String(room._id), roomCode: room.code, fromUserId: userId },
  });
  return { invited: true, roomCode: room.code };
}

/** Periodic job: expire rooms nobody started in time. */
export async function expireRooms(now = new Date()): Promise<number> {
  const rooms = await RoomModel.find({ status: { $in: ['WAITING', 'FULL', 'READY'] }, expiresAt: { $lte: now } }).limit(200);
  for (const r of rooms) {
    const u = await RoomModel.updateOne({ _id: r._id, status: { $in: ['WAITING', 'FULL', 'READY'] } }, { $set: { status: 'EXPIRED' } });
    if (u.modifiedCount) realtime.emitToRoom(r._id, 'room:expired', { roomId: String(r._id), reason: 'EXPIRED' });
  }
  return rooms.length;
}
