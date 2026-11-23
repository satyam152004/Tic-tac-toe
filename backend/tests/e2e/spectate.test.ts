import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auth, clearDb, connectSocket, Env, registerUser, startEnv, stopEnv, TestSocket, TestUser } from '../helpers.js';

let env: Env;
let alice: TestUser;
let bob: TestUser;
let carol: TestUser;
const sockets: TestSocket[] = [];
const connect = async (u: TestUser) => {
  const s = await connectSocket(env.url, u.token);
  sockets.push(s);
  return s;
};
const api = () => request(env.app);

beforeAll(async () => void (env = await startEnv()));
afterAll(async () => stopEnv(env));
beforeEach(async () => {
  await clearDb();
  alice = await registerUser(env.app, 'alice');
  bob = await registerUser(env.app, 'bobby');
  carol = await registerUser(env.app, 'carol');
});
afterEach(() => sockets.splice(0).forEach((s) => s.close()));

async function befriend(a: TestUser, b: TestUser) {
  const r = await api().post('/api/v1/friends/request').set(auth(a)).send({ userId: b.id });
  await api().post(`/api/v1/friends/${r.body.data.id}/accept`).set(auth(b));
}

async function liveGame() {
  const sa = await connect(alice);
  const sb = await connect(bob);
  const found = sa.waitFor('matchmaking:found');
  await sa.emit('matchmaking:join', { boardSize: 3 });
  await sa.waitFor('matchmaking:queued');
  await sb.emit('matchmaking:join', { boardSize: 3 });
  const { gameId } = await found;
  await sa.emit('game:join', { gameId });
  await sb.emit('game:join', { gameId });
  await sa.waitFor('game:started');
  return { sa, sb, gameId: gameId as string };
}

describe('spectating', () => {
  it('lets an accepted friend watch live, read-only, with updates, cheers and a spectator count', async () => {
    await befriend(carol, alice);
    const { sa, gameId } = await liveGame();

    const list = await api().get('/api/v1/friends').set(auth(carol));
    expect(list.body.data[0].activeGameId).toBe(gameId);

    const sc = await connect(carol);
    const res = await sc.emit('game:spectate', { gameId });
    expect(res.ok).toBe(true);
    expect(res.data.game.id).toBe(gameId);
    expect(res.data.players).toHaveLength(2);
    expect(res.data.spectators).toBe(1);

    // spectators cannot move
    const move = await api().post(`/api/v1/games/${gameId}/moves`).set(auth(carol)).send({ position: 0 });
    expect(move.status).toBe(403);

    const cheer = sa.waitFor('game:cheer');
    expect((await sc.emit('game:cheer', { gameId, kind: 'fire' })).ok).toBe(true);
    expect((await cheer).kind).toBe('fire');

    const mover = (await api().get(`/api/v1/games/${gameId}`).set(auth(alice))).body.data.currentTurn;
    const turnUser = (await api().get(`/api/v1/games/${gameId}`).set(auth(alice))).body.data.players.find((p: { mark: string }) => p.mark === mover).userId;
    const updated = sc.waitFor('game:updated', (p: { lastMove?: unknown; game: { moveCount: number } }) => !!p.lastMove, 5000, true);
    await api().post(`/api/v1/games/${gameId}/moves`).set(auth(turnUser === alice.id ? alice : bob)).send({ position: 4 });
    expect((await updated).game.moveCount).toBe(1);

    expect((await sc.emit('game:unspectate', { gameId })).ok).toBe(true);
  });

  it('refuses strangers, non-spectators cheering, and friends who disabled spectating', async () => {
    const { gameId } = await liveGame();
    const sc = await connect(carol);
    expect((await sc.emit('game:spectate', { gameId })).error?.code).toBe('NOT_A_FRIEND');
    expect((await sc.emit('game:cheer', { gameId, kind: 'clap' })).error?.code).toBe('NOT_SPECTATING');

    await befriend(carol, alice);
    await befriend(carol, bob);
    await api().patch('/api/v1/users/me').set(auth(alice)).send({ privacy: { allowSpectating: false } });
    // bob still allows it, so watching is possible through him; once both opt out it is refused
    expect((await sc.emit('game:spectate', { gameId })).ok).toBe(true);
    await sc.emit('game:unspectate', { gameId });
    await api().patch('/api/v1/users/me').set(auth(bob)).send({ privacy: { allowSpectating: false } });
    expect((await sc.emit('game:spectate', { gameId })).error?.code).toBe('SPECTATING_DISABLED');
    const list = await api().get('/api/v1/friends').set(auth(carol));
    expect(list.body.data.every((f: { activeGameId: string | null }) => f.activeGameId === null)).toBe(true);
  });
});
