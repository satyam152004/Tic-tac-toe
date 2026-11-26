import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CoinLedgerModel, FriendshipModel, GameModel, UserModel, makePairKey } from '../../src/models/index.js';
import { auth, clearDb, Env, registerUser, startEnv, stopEnv, TestUser } from '../helpers.js';

let env: Env;
beforeAll(async () => void (env = await startEnv()));
afterAll(async () => stopEnv(env));
beforeEach(async () => clearDb());

const api = () => request(env.app);
const coinsOf = async (u: TestUser) => (await UserModel.findById(u.id).lean())!.wallet!.coins;
const setCoins = (u: TestUser, coins: number) => UserModel.updateOne({ _id: u.id }, { $set: { 'wallet.coins': coins } });

describe('paid quick matches', () => {
  it('takes the entry from both players when the match starts, and records the pot on the game', async () => {
    const alice = await registerUser(env.app, 'qa_alice');
    const bob = await registerUser(env.app, 'qa_bob');
    await setCoins(alice, 100);
    await setCoins(bob, 100);
    await api().post('/api/v1/matchmaking/join').set(auth(alice)).send({ boardSize: 3, entryAmount: 25 });
    const m = await api().post('/api/v1/matchmaking/join').set(auth(bob)).send({ boardSize: 3, entryAmount: 25 });
    expect(m.body.data.status).toBe('MATCHED');
    expect(await coinsOf(alice)).toBe(75);
    expect(await coinsOf(bob)).toBe(75);
    const game = await GameModel.findById(m.body.data.game.id).lean();
    expect(game?.entryAmount).toBe(25);
  });

  it('pairs only players who chose the same entry', async () => {
    const alice = await registerUser(env.app, 'qb_alice');
    const bob = await registerUser(env.app, 'qb_bob');
    await setCoins(alice, 100);
    await setCoins(bob, 100);
    await api().post('/api/v1/matchmaking/join').set(auth(alice)).send({ boardSize: 3, entryAmount: 10 });
    const m = await api().post('/api/v1/matchmaking/join').set(auth(bob)).send({ boardSize: 3, entryAmount: 25 });
    expect(m.body.data.status).toBe('QUEUED');
    expect(await coinsOf(alice)).toBe(100);
  });

  it('refuses a player who cannot cover the entry, and does not queue them', async () => {
    const broke = await registerUser(env.app, 'qc_broke');
    await setCoins(broke, 5);
    const res = await api().post('/api/v1/matchmaking/join').set(auth(broke)).send({ boardSize: 3, entryAmount: 25 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_COINS');
    expect(await coinsOf(broke)).toBe(5);
  });

  it('a free quick match charges nothing', async () => {
    const alice = await registerUser(env.app, 'qd_alice');
    const bob = await registerUser(env.app, 'qd_bob');
    await setCoins(alice, 0);
    await setCoins(bob, 0);
    await api().post('/api/v1/matchmaking/join').set(auth(alice)).send({ boardSize: 3 });
    const m = await api().post('/api/v1/matchmaking/join').set(auth(bob)).send({ boardSize: 3 });
    expect(m.body.data.status).toBe('MATCHED');
    expect(await CoinLedgerModel.countDocuments({ reason: 'ENTRY' })).toBe(0);
  });
});

describe('paid friend challenges', () => {
  async function makeFriends() {
    const a = await registerUser(env.app, 'fa_inviter');
    const b = await registerUser(env.app, 'fb_friend');
    await FriendshipModel.create({ requesterId: a.id, recipientId: b.id, pairKey: makePairKey(a.id, b.id), status: 'ACCEPTED' });
    await setCoins(a, 100);
    await setCoins(b, 100);
    return { a, b };
  }

  it('takes the entry from both players only when the friend accepts', async () => {
    const { a, b } = await makeFriends();
    const created = await api().post('/api/v1/games').set(auth(a)).send({ type: 'FRIEND', boardSize: 3, entryAmount: 10, opponentId: b.id });
    expect(created.status).toBe(201);
    expect(await coinsOf(a)).toBe(100);
    expect(await coinsOf(b)).toBe(100);
    const gameId = created.body.data.id;
    await api().post(`/api/v1/games/${gameId}/join`).set(auth(b));
    expect(await coinsOf(a)).toBe(90);
    expect(await coinsOf(b)).toBe(90);
  });

  it('refuses an invite the inviter cannot afford', async () => {
    const { a, b } = await makeFriends();
    await setCoins(a, 5);
    const res = await api().post('/api/v1/games').set(auth(a)).send({ type: 'FRIEND', boardSize: 3, entryAmount: 10, opponentId: b.id });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_COINS');
  });
});
