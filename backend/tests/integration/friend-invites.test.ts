import request from 'supertest';
import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FriendshipModel, GameModel, NotificationModel, makePairKey } from '../../src/models/index.js';
import { processGameTimeouts } from '../../src/services/game.service.js';
import { auth, clearDb, Env, registerUser, startEnv, stopEnv, TestUser } from '../helpers.js';

let env: Env;
beforeAll(async () => void (env = await startEnv()));
afterAll(async () => stopEnv(env));
beforeEach(async () => clearDb());

const api = () => request(env.app);

async function makeFriends() {
  const a = await registerUser(env.app, 'inv_sender');
  const b = await registerUser(env.app, 'inv_friend');
  await FriendshipModel.create({ requesterId: a.id, recipientId: b.id, pairKey: makePairKey(a.id, b.id), status: 'ACCEPTED' });
  return { a, b };
}

async function challenge(from: TestUser, to: TestUser) {
  const res = await api().post('/api/v1/games').set(auth(from)).send({ type: 'FRIEND', boardSize: 3, opponentId: to.id });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

describe('friend challenge invites', () => {
  it('lists the challenge for the friend (incoming) and for the sender (outgoing), with an expiry time', async () => {
    const { a, b } = await makeFriends();
    const gameId = await challenge(a, b);
    const incoming = await api().get('/api/v1/games/invites').set(auth(b));
    expect(incoming.body.data.incoming.map((i: { game: { id: string } }) => i.game.id)).toEqual([gameId]);
    expect(incoming.body.data.outgoing).toHaveLength(0);
    const outgoing = await api().get('/api/v1/games/invites').set(auth(a));
    expect(outgoing.body.data.outgoing.map((i: { game: { id: string } }) => i.game.id)).toEqual([gameId]);
    expect(outgoing.body.data.incoming).toHaveLength(0);
    expect(new Date(outgoing.body.data.outgoing[0].expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('the friend can decline; the sender is told, and the challenge leaves both lists', async () => {
    const { a, b } = await makeFriends();
    const gameId = await challenge(a, b);
    const res = await api().post(`/api/v1/games/${gameId}/decline`).set(auth(b));
    expect(res.status).toBe(200);
    expect((await api().get('/api/v1/games/invites').set(auth(b))).body.data.incoming).toHaveLength(0);
    expect((await api().get('/api/v1/games/invites').set(auth(a))).body.data.outgoing).toHaveLength(0);
    expect(await NotificationModel.countDocuments({ userId: a.id, type: 'GAME_INVITE_DECLINED' })).toBe(1);
    expect((await GameModel.findById(gameId).lean())?.status).toBe('CANCELLED');
  });

  it('only the friend can decline, and a declined challenge cannot be accepted', async () => {
    const { a, b } = await makeFriends();
    const gameId = await challenge(a, b);
    expect((await api().post(`/api/v1/games/${gameId}/decline`).set(auth(a))).status).toBe(403);
    await api().post(`/api/v1/games/${gameId}/decline`).set(auth(b));
    const late = await api().post(`/api/v1/games/${gameId}/join`).set(auth(b));
    expect(late.status).not.toBe(200);
  });

  it('the sender can cancel a waiting challenge; the friend is told, and only the sender can cancel', async () => {
    const { a, b } = await makeFriends();
    const gameId = await challenge(a, b);
    expect((await api().post(`/api/v1/games/${gameId}/cancel`).set(auth(b))).status).toBe(403);
    const res = await api().post(`/api/v1/games/${gameId}/cancel`).set(auth(a));
    expect(res.status).toBe(200);
    expect(await NotificationModel.countDocuments({ userId: b.id, type: 'GAME_INVITE_CANCELLED' })).toBe(1);
    const again = await api().post(`/api/v1/games/${gameId}/cancel`).set(auth(a));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVITE_CLOSED');
  });

  it('an unanswered challenge expires after 10 minutes and both players are told', async () => {
    const { a, b } = await makeFriends();
    const gameId = await challenge(a, b);
    // Written straight to the collection: Mongoose timestamps would otherwise overwrite createdAt.
    await GameModel.collection.updateOne({ _id: new Types.ObjectId(gameId) }, { $set: { createdAt: new Date(Date.now() - 11 * 60_000) } });
    await processGameTimeouts();
    expect((await GameModel.findById(gameId).lean())?.status).toBe('EXPIRED');
    expect(await NotificationModel.countDocuments({ userId: a.id, type: 'GAME_INVITE_EXPIRED' })).toBe(1);
    expect(await NotificationModel.countDocuments({ userId: b.id, type: 'GAME_INVITE_EXPIRED' })).toBe(1);
  });
});
