import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDb, connectSocket, Env, registerUser, startEnv, stopEnv, TestSocket, TestUser } from '../helpers.js';

let env: Env;
let alice: TestUser;
let bob: TestUser;
const sockets: TestSocket[] = [];
const connect = async (u: TestUser) => {
  const s = await connectSocket(env.url, u.token);
  sockets.push(s);
  return s;
};

beforeAll(async () => void (env = await startEnv()));
afterAll(async () => stopEnv(env));
beforeEach(async () => {
  await clearDb();
  alice = await registerUser(env.app, 'alice');
  bob = await registerUser(env.app, 'bobby');
});
afterEach(() => sockets.splice(0).forEach((s) => s.close()));

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

describe('mutual draw offers', () => {
  it('ends the game as a draw when the opponent accepts', async () => {
    const { sa, sb, gameId } = await liveGame();
    const offered = sb.waitFor('game:draw-offered');
    const r = await sa.emit('game:offer-draw', { gameId });
    expect(r.ok).toBe(true);
    expect((await offered).by).toBe(alice.id);
    expect((await sa.emit('game:offer-draw', { gameId })).error?.code).toBe('DRAW_OFFER_PENDING');
    expect((await sa.emit('game:respond-draw', { gameId, accept: true })).error?.code).toBe('OWN_DRAW_OFFER');

    const draw = sa.waitFor('game:draw');
    const ack = await sb.emit('game:respond-draw', { gameId, accept: true });
    expect(ack.ok).toBe(true);
    const g = (await draw).game;
    expect(g.status).toBe('DRAW');
    expect(g.result.reason).toBe('DRAW');
    expect(g.players.every((p: { outcome: string }) => p.outcome === 'DRAW')).toBe(true);
  });

  it('declining clears the offer, and answers need an open offer', async () => {
    const { sa, sb, gameId } = await liveGame();
    expect((await sb.emit('game:respond-draw', { gameId, accept: true })).error?.code).toBe('NO_DRAW_OFFER');
    await sa.emit('game:offer-draw', { gameId });
    const declined = sa.waitFor('game:draw-declined');
    expect((await sb.emit('game:respond-draw', { gameId, accept: false })).ok).toBe(true);
    expect((await declined).by).toBe(bob.id);
    expect((await sa.emit('game:offer-draw', { gameId })).ok).toBe(true);
  });
});
