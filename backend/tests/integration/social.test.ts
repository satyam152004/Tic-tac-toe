import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DeviceTokenModel, NotificationModel, UserModel } from '../../src/models/index.js';
import { auth, clearDb, Env, playMoves, registerUser, startEnv, startOnlineGame, stopEnv, TestUser } from '../helpers.js';

let env: Env;
let alice: TestUser;
let bob: TestUser;
beforeAll(async () => void (env = await startEnv()));
afterAll(async () => stopEnv(env));
beforeEach(async () => {
  await clearDb();
  alice = await registerUser(env.app, 'alice');
  bob = await registerUser(env.app, 'bobby');
});
const api = () => request(env.app);

describe('friends', () => {
  it('request -> accept flow with duplicate/self protection', async () => {
    expect((await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: alice.id })).body.error.code).toBe('SELF_REQUEST');
    expect((await api().post('/api/v1/friends/request').set(auth(alice)).send({ username: 'ALICE' })).body.error.code).toBe('SELF_REQUEST');
    expect((await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: '0'.repeat(24) })).body.error.code).toBe('USER_NOT_FOUND');
    expect((await api().post('/api/v1/friends/request').set(auth(alice)).send({})).status).toBe(400);

    const r = await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: bob.id });
    expect(r.status).toBe(201);
    const dup = await api().post('/api/v1/friends/request').set(auth(alice)).send({ username: 'bobby' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('REQUEST_ALREADY_SENT');

    const incoming = await api().get('/api/v1/friends?status=incoming').set(auth(bob));
    expect(incoming.body.data).toHaveLength(1);
    const outgoing = await api().get('/api/v1/friends?status=outgoing').set(auth(alice));
    expect(outgoing.body.data[0].user.username).toBe('bobby');

    // only the recipient can accept
    expect((await api().post(`/api/v1/friends/${r.body.data.id}/accept`).set(auth(alice))).status).toBe(404);
    expect((await api().post(`/api/v1/friends/${r.body.data.id}/accept`).set(auth(bob))).body.data.status).toBe('ACCEPTED');
    expect((await api().post('/api/v1/friends/request').set(auth(bob)).send({ userId: alice.id })).body.error.code).toBe('ALREADY_FRIENDS');
    expect((await api().get('/api/v1/friends').set(auth(alice))).body.data).toHaveLength(1);
    expect((await api().get('/api/v1/friends').set(auth(bob))).body.data[0].user.username).toBe('alice');

    // third parties cannot remove it, either friend can
    const carol = await registerUser(env.app, 'carol');
    expect((await api().delete(`/api/v1/friends/${r.body.data.id}`).set(auth(carol))).status).toBe(404);
    expect((await api().delete(`/api/v1/friends/${r.body.data.id}`).set(auth(bob))).body.data.removed).toBe(true);
    expect((await api().get('/api/v1/friends').set(auth(alice))).body.data).toHaveLength(0);
  });

  it('reject, cancel and mutual requests', async () => {
    const r = await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: bob.id });
    expect((await api().post(`/api/v1/friends/${r.body.data.id}/reject`).set(auth(bob))).body.data.rejected).toBe(true);
    // can ask again after a rejection, then cancel own pending request
    const r2 = await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: bob.id });
    expect((await api().delete(`/api/v1/friends/${r2.body.data.id}`).set(auth(alice))).status).toBe(200);
    // simultaneous opposite requests => the second one accepts the first
    await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: bob.id });
    const back = await api().post('/api/v1/friends/request').set(auth(bob)).send({ userId: alice.id });
    expect(back.body.data.status).toBe('ACCEPTED');
  });

  it('block removes the friendship, hides the blocker, and unblock restores contact', async () => {
    const r = await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: bob.id });
    await api().post(`/api/v1/friends/${r.body.data.id}/accept`).set(auth(bob));
    expect((await api().post(`/api/v1/friends/${alice.id}/block`).set(auth(alice))).body.error.code).toBe('SELF_BLOCK');
    expect((await api().post(`/api/v1/friends/${bob.id}/block`).set(auth(alice))).body.data.blocked).toBe(true);
    expect((await api().post(`/api/v1/friends/${bob.id}/block`).set(auth(alice))).status).toBe(200); // idempotent
    expect((await api().get('/api/v1/friends').set(auth(alice))).body.data).toHaveLength(0);
    // the blocked player cannot find / view / befriend the blocker
    expect((await api().get('/api/v1/users/search?q=alice').set(auth(bob))).body.data).toHaveLength(0);
    expect((await api().get(`/api/v1/users/${alice.id}`).set(auth(bob))).status).toBe(404);
    expect((await api().post('/api/v1/friends/request').set(auth(bob)).send({ userId: alice.id })).status).toBe(404);
    expect((await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: bob.id })).body.error.code).toBe('BLOCKED');
    expect((await api().get('/api/v1/friends/blocked').set(auth(alice))).body.data.map((u: { username: string }) => u.username)).toEqual(['bobby']);

    expect((await api().post(`/api/v1/friends/${bob.id}/unblock`).set(auth(alice))).body.data.blocked).toBe(false);
    expect((await api().post(`/api/v1/friends/${bob.id}/unblock`).set(auth(alice))).body.error.code).toBe('NOT_BLOCKED');
    expect((await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: bob.id })).status).toBe(201);
  });

  it('only friends can be invited to a game or room', async () => {
    const g = await api().post('/api/v1/games').set(auth(alice)).send({ type: 'FRIEND', boardSize: 3, opponentId: bob.id });
    expect(g.body.error.code).toBe('NOT_FRIENDS');
    const room = (await api().post('/api/v1/rooms').set(auth(alice)).send({ boardSize: 3 })).body.data;
    expect((await api().post(`/api/v1/rooms/${room.id}/invite`).set(auth(alice)).send({ friendId: bob.id })).body.error.code).toBe('NOT_FRIENDS');
    const r = await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: bob.id });
    await api().post(`/api/v1/friends/${r.body.data.id}/accept`).set(auth(bob));
    const inv = await api().post(`/api/v1/rooms/${room.id}/invite`).set(auth(alice)).send({ friendId: bob.id });
    expect(inv.body.data).toMatchObject({ invited: true, roomCode: room.code });
    const n = await api().get('/api/v1/notifications').set(auth(bob));
    expect(n.body.data.find((x: { type: string }) => x.type === 'GAME_INVITE').data.roomCode).toBe(room.code);
    expect((await api().get(`/api/v1/rooms/${room.id}`).set(auth(bob))).status).toBe(200); // invited users may view
    expect((await api().get(`/api/v1/rooms/${room.id}`).set(auth(await registerUser(env.app, 'zed_'))))).toMatchObject({ status: 403 });
  });
});

describe('notifications', () => {
  it('stores history, tracks read state, supports pagination, delete and ownership', async () => {
    const r = await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: bob.id });
    await api().post(`/api/v1/friends/${r.body.data.id}/accept`).set(auth(bob));
    const bobList = await api().get('/api/v1/notifications').set(auth(bob));
    expect(bobList.body.data).toHaveLength(1);
    expect(bobList.body.meta).toMatchObject({ unread: 1, total: 1 });
    const id = bobList.body.data[0].id;
    expect((await api().patch(`/api/v1/notifications/${id}/read`).set(auth(alice))).status).toBe(404); // not yours
    const read = await api().patch(`/api/v1/notifications/${id}/read`).set(auth(bob));
    expect(read.body.data.readAt).toBeTruthy();
    expect((await api().get('/api/v1/notifications?unreadOnly=true').set(auth(bob))).body.data).toHaveLength(0);

    const aliceList = await api().get('/api/v1/notifications').set(auth(alice)); // FRIEND_ACCEPTED
    expect(aliceList.body.data[0].type).toBe('FRIEND_ACCEPTED');
    await NotificationModel.create({ userId: alice.id, type: 'ACCOUNT', category: 'account', title: 't', body: 'b', expireAt: new Date(Date.now() + 1e9) });
    expect((await api().patch('/api/v1/notifications/read-all').set(auth(alice))).body.data.updated).toBe(2);
    const page = await api().get('/api/v1/notifications?limit=1&page=2').set(auth(alice));
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta).toMatchObject({ page: 2, limit: 1, total: 2, totalPages: 2, unread: 0 });
    expect((await api().delete(`/api/v1/notifications/${aliceList.body.data[0].id}`).set(auth(alice))).body.data.deleted).toBe(true);
    expect((await api().delete(`/api/v1/notifications/${aliceList.body.data[0].id}`).set(auth(alice))).status).toBe(404);
  });

  it('respects notification preferences', async () => {
    await api().patch('/api/v1/users/me').set(auth(bob)).send({ notificationPrefs: { social: false } });
    await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: bob.id });
    expect((await api().get('/api/v1/notifications').set(auth(bob))).body.data).toHaveLength(0);
  });

  it('registers, refreshes and removes device tokens (per owner)', async () => {
    const token = 'fcm-token-' + 'x'.repeat(40);
    const reg = await api().post('/api/v1/devices/register').set(auth(alice)).send({ token, platform: 'android', deviceName: 'Pixel' });
    expect(reg.status).toBe(201);
    expect(JSON.stringify(reg.body)).not.toContain(token); // token itself is never echoed
    const again = await api().post('/api/v1/devices/register').set(auth(alice)).send({ token, platform: 'android' });
    expect(again.body.data.id).toBe(reg.body.data.id);
    expect(await DeviceTokenModel.countDocuments()).toBe(1);
    // the same phone logs into another account: the token moves to that account
    await api().post('/api/v1/devices/register').set(auth(bob)).send({ token, platform: 'ios' });
    expect((await DeviceTokenModel.findOne().lean())!.userId.toString()).toBe(bob.id);
    expect((await api().delete(`/api/v1/devices/${reg.body.data.id}`).set(auth(alice))).status).toBe(404);
    expect((await api().delete(`/api/v1/devices/${reg.body.data.id}`).set(auth(bob))).status).toBe(200);
    expect((await api().post('/api/v1/devices/register').set(auth(bob)).send({ token, platform: 'windows' })).status).toBe(400);
  });
});

describe('leaderboards (server-verified scores only)', () => {
  it('ranks by backend points on every board; clients cannot influence scores', async () => {
    const { gameId, x, o } = await startOnlineGame(env.app, alice, bob);
    await playMoves(env.app, gameId, [[x, 0], [o, 3], [x, 1], [o, 4], [x, 2]]);

    // direct score tampering attempts
    expect((await api().patch('/api/v1/users/me').set(auth(o)).send({ stats: { points: 99999 } })).status).toBe(400);
    expect((await api().patch('/api/v1/users/me').set(auth(o)).send({ 'stats.points': 99999 })).status).toBe(400);
    expect((await api().post('/api/v1/leaderboard/global').set(auth(o)).send({ points: 1 })).status).toBe(404);

    for (const board of ['global', 'daily', 'weekly', 'monthly']) {
      const res = await api().get(`/api/v1/leaderboard/${board}`).set(auth(o));
      expect(res.status).toBe(200);
      expect(res.body.data.map((e: { user: { username: string }; rank: number; points: number }) => [e.rank, e.user.username, e.points])).toEqual([
        [1, x.username, 25],
        [2, o.username, 3],
      ]);
      expect(res.body.meta.me).toMatchObject({ rank: 2, points: 3 });
    }
    const wins = await api().get('/api/v1/leaderboard/global?metric=wins&limit=1').set(auth(o));
    expect(wins.body.data).toHaveLength(1);
    expect(wins.body.meta).toMatchObject({ total: 2, totalPages: 2 });

    // friends board only shows me + friends
    const carol = await registerUser(env.app, 'carol');
    const fb = await api().get('/api/v1/leaderboard/friends').set(auth(carol));
    expect(fb.body.data.map((e: { user: { username: string } }) => e.user.username)).toEqual(['carol']);
    const r = await api().post('/api/v1/friends/request').set(auth(carol)).send({ userId: x.id });
    await api().post(`/api/v1/friends/${r.body.data.id}/accept`).set(auth(x));
    const fb2 = await api().get('/api/v1/leaderboard/friends').set(auth(carol));
    expect(fb2.body.data.map((e: { user: { username: string }; isMe: boolean }) => [e.user.username, e.isMe])).toEqual([[x.username, false], ['carol', true]]);
    expect((await api().get('/api/v1/leaderboard/global?limit=1000').set(auth(o))).status).toBe(400);
  });
});

describe('offline (local) match sync', () => {
  const win = { size: 3, winLength: 3, mode: 'VS_AI', difficulty: 'EASY', humanMark: 'X', moves: [0, 3, 1, 4, 2], durationMs: 12000 };

  it('verifies results by replaying moves, ignores claimed results, stays idempotent and never awards points', async () => {
    const res = await api().post('/api/v1/statistics/me/local-matches').set(auth(alice)).send({ matches: [
      { ...win, clientMatchId: 'local-aaaa-0001' },
      { ...win, clientMatchId: 'local-aaaa-0002', moves: [0, 3, 1, 4, 5, 8, 7, 6, 2] }, // not a win for X -> replay decides
      { ...win, clientMatchId: 'local-aaaa-0003', moves: [0, 0, 1, 4, 2] }, // illegal: occupied cell
      { ...win, clientMatchId: 'local-aaaa-0004', moves: [0, 3, 1, 4] }, // unfinished
    ] });
    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(2);
    expect(res.body.data.rejected.map((r: { clientMatchId: string }) => r.clientMatchId).sort()).toEqual(['local-aaaa-0003', 'local-aaaa-0004']);

    const dup = await api().post('/api/v1/statistics/me/local-matches').set(auth(alice)).send({ matches: [{ ...win, clientMatchId: 'local-aaaa-0001' }] });
    expect(dup.body.data).toMatchObject({ accepted: 0, duplicates: 1 });

    const stats = (await api().get('/api/v1/statistics/me').set(auth(alice))).body.data;
    expect(stats.local.games).toBe(2);
    expect(stats.points).toBe(0);
    expect(stats.totalGames).toBe(0); // local games never inflate the verified online/AI totals
    const hist = await api().get('/api/v1/statistics/me/history?type=LOCAL').set(auth(alice));
    expect(hist.body.data).toHaveLength(2);
    expect((await api().get('/api/v1/leaderboard/global').set(auth(alice))).body.data).toHaveLength(0);
  });
});

describe('reports', () => {
  it('lets a player report another, with limits', async () => {
    expect((await api().post(`/api/v1/users/${alice.id}/report`).set(auth(alice)).send({ reason: 'SPAM' })).body.error.code).toBe('SELF_REPORT');
    expect((await api().post(`/api/v1/users/${bob.id}/report`).set(auth(alice)).send({ reason: 'nope' })).status).toBe(400);
    for (let i = 0; i < 3; i++) expect((await api().post(`/api/v1/users/${bob.id}/report`).set(auth(alice)).send({ reason: 'ABUSE', details: 'rude' })).status).toBe(201);
    expect((await api().post(`/api/v1/users/${bob.id}/report`).set(auth(alice)).send({ reason: 'ABUSE' })).status).toBe(429);
    expect(await UserModel.countDocuments()).toBe(2);
  });
});
