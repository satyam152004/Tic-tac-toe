import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CoinLedgerModel, RoomModel, UserModel } from '../../src/models/index.js';
import { finalizeGame } from '../../src/services/finalize.service.js';
import { auth, clearDb, Env, playMoves, registerUser, startEnv, stopEnv, TestUser } from '../helpers.js';

let env: Env;
beforeAll(async () => void (env = await startEnv()));
afterAll(async () => stopEnv(env));
beforeEach(async () => clearDb());

const api = () => request(env.app);
const coinsOf = async (u: TestUser) => (await UserModel.findById(u.id).lean())!.wallet!.coins;
const setCoins = (u: TestUser, coins: number) => UserModel.updateOne({ _id: u.id }, { $set: { 'wallet.coins': coins } });

/** Host creates a room with the given entry; both players start with `coins`. */
async function makeRoom(entryAmount: number, coins = 100) {
  const host = await registerUser(env.app, 'host');
  const guest = await registerUser(env.app, 'guest');
  await setCoins(host, coins);
  await setCoins(guest, coins);
  const created = await api().post('/api/v1/rooms').set(auth(host)).send({ boardSize: 3, entryAmount });
  return { host, guest, room: created.body.data };
}

/** Guest joins and readies up; the host then starts the match. */
async function joinAndStart(host: TestUser, guest: TestUser, room: { id: string; code: string }) {
  await api().post('/api/v1/rooms/join').set(auth(guest)).send({ code: room.code });
  await api().post(`/api/v1/rooms/${room.id}/ready`).set(auth(guest)).send({ ready: true });
  return api().post(`/api/v1/rooms/${room.id}/start`).set(auth(host));
}

/** Both players join the game; returns the X and O players. */
async function seatGame(gameId: string, a: TestUser, b: TestUser) {
  await api().post(`/api/v1/games/${gameId}/join`).set(auth(a));
  const g = (await api().post(`/api/v1/games/${gameId}/join`).set(auth(b))).body.data;
  const x = g.players.find((p: { mark: string }) => p.mark === 'X').userId === a.id ? a : b;
  return { x, o: x === a ? b : a };
}

describe('paid room entries', () => {
  it('shows the entry and the prize on the room, and free rooms stay free', async () => {
    const { room } = await makeRoom(25);
    expect(room.entryAmount).toBe(25);
    expect(room.prize).toBe(50);
    const free = await api().post('/api/v1/rooms').set(auth(await registerUser(env.app, 'solo'))).send({ boardSize: 3 });
    expect(free.body.data.entryAmount).toBe(0);
    expect(free.body.data.prize).toBe(0);
  });

  it('refuses a host who cannot cover the entry, and creates no room', async () => {
    const host = await registerUser(env.app, 'broke_host');
    await setCoins(host, 5);
    const res = await api().post('/api/v1/rooms').set(auth(host)).send({ boardSize: 3, entryAmount: 25 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_COINS');
    expect(await RoomModel.countDocuments({ hostId: host.id })).toBe(0);
  });

  it('refuses a guest who cannot cover the entry when joining', async () => {
    const { host, guest, room } = await makeRoom(25);
    await setCoins(guest, 10);
    const res = await api().post('/api/v1/rooms/join').set(auth(guest)).send({ code: room.code });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_COINS');
    expect((await api().get(`/api/v1/rooms/${room.id}`).set(auth(host))).body.data.status).toBe('WAITING');
  });

  it('charges both players at start and pays the winner both entries', async () => {
    const { host, guest, room } = await makeRoom(25);
    await api().post('/api/v1/rooms/join').set(auth(guest)).send({ code: room.code });
    await api().post(`/api/v1/rooms/${room.id}/ready`).set(auth(guest)).send({ ready: true });
    expect(await coinsOf(host)).toBe(100); // nothing taken before the match starts

    const started = await api().post(`/api/v1/rooms/${room.id}/start`).set(auth(host));
    expect(started.status).toBe(200);
    expect(await coinsOf(host)).toBe(75);
    expect(await coinsOf(guest)).toBe(75);
    expect(started.body.data.game.entryAmount).toBe(25);

    const gameId = started.body.data.game.id;
    const { x, o } = await seatGame(gameId, host, guest);
    await playMoves(env.app, gameId, [[x, 0], [o, 3], [x, 1], [o, 4], [x, 2]]);

    expect(await coinsOf(x)).toBe(125); // 75 + both entries
    expect(await coinsOf(o)).toBe(75);
    // Settling again (a retried finalize) must not pay twice.
    await finalizeGame(gameId);
    expect(await coinsOf(x)).toBe(125);
    expect(await CoinLedgerModel.countDocuments({ refId: gameId, reason: 'PRIZE' })).toBe(1);
  });

  it('refunds both entries on a draw', async () => {
    const { host, guest, room } = await makeRoom(10);
    const started = await joinAndStart(host, guest, room);
    const gameId = started.body.data.game.id;
    const { x, o } = await seatGame(gameId, host, guest);
    // A full 3x3 board with no line: draw.
    await playMoves(env.app, gameId, [[x, 0], [o, 1], [x, 2], [o, 4], [x, 3], [o, 5], [x, 7], [o, 6], [x, 8]]);
    expect(await coinsOf(host)).toBe(100);
    expect(await coinsOf(guest)).toBe(100);
  });

  it('refuses to start when a player no longer has the entry, and takes nothing', async () => {
    const { host, guest, room } = await makeRoom(25);
    await api().post('/api/v1/rooms/join').set(auth(guest)).send({ code: room.code });
    await api().post(`/api/v1/rooms/${room.id}/ready`).set(auth(guest)).send({ ready: true });
    await setCoins(guest, 10); // spent elsewhere after joining

    const res = await api().post(`/api/v1/rooms/${room.id}/start`).set(auth(host));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_COINS');
    expect(await coinsOf(host)).toBe(100);
    expect(await coinsOf(guest)).toBe(10);
    expect((await api().get(`/api/v1/rooms/${room.id}`).set(auth(host))).body.data.status).toBe('READY');
  });
});
