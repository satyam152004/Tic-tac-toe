import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GameModel } from '../../src/models/index.js';
import { processGameTimeouts } from '../../src/services/game.service.js';
import { auth, clearDb, connectSocket, Env, registerUser, sleep, startEnv, stopEnv, TestSocket, TestUser } from '../helpers.js';

let env: Env;
let alice: TestUser;
let bob: TestUser;
const sockets: TestSocket[] = [];
const connect = async (u: TestUser | { token?: string }) => {
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
afterEach(() => {
  sockets.splice(0).forEach((s) => s.close());
});

const api = () => request(env.app);

/** Both players quick-match over sockets and join the game room. Returns sockets + marks. */
async function matchOverSockets(size = 3) {
  const sa = await connect(alice);
  const sb = await connect(bob);
  const foundA = sa.waitFor('matchmaking:found');
  const foundB = sb.waitFor('matchmaking:found');
  const q1 = await sa.emit('matchmaking:join', { boardSize: size });
  expect(q1.ok).toBe(true);
  expect(q1.data.status).toBe('QUEUED');
  await sa.waitFor('matchmaking:queued');
  const q2 = await sb.emit('matchmaking:join', { boardSize: size });
  expect(q2.data.status).toBe('MATCHED');
  const [fa, fb] = await Promise.all([foundA, foundB]);
  expect(fa.gameId).toBe(fb.gameId);
  expect(fa.opponent.username).toBe('bobby');
  expect(fb.opponent.username).toBe('alice');

  const startedA = sa.waitFor('game:started');
  const startedB = sb.waitFor('game:started');
  await sa.emit('game:join', { gameId: fa.gameId });
  await sb.emit('game:join', { gameId: fa.gameId });
  const [st] = await Promise.all([startedA, startedB]);
  const markOf = (id: string) => st.game.players.find((p: { userId: string }) => p.userId === id).mark;
  const aliceIsX = markOf(alice.id) === 'X';
  return { sa, sb, gameId: fa.gameId as string, x: aliceIsX ? sa : sb, o: aliceIsX ? sb : sa, xUser: aliceIsX ? alice : bob, oUser: aliceIsX ? bob : alice };
}

describe('socket authentication & authorization', () => {
  it('rejects connections without a valid token', async () => {
    await expect(connect({})).rejects.toMatchObject({ message: expect.stringMatching(/sign in/i) });
    await expect(connect({ token: 'garbage' })).rejects.toMatchObject({ data: { code: 'INVALID_TOKEN' } });
  });

  it('rejects expired tokens with TOKEN_EXPIRED so the client can refresh', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const expired = jwt.sign({ sid: 'x', act: 'REGISTERED', typ: 'access' }, process.env.JWT_ACCESS_SECRET!, { subject: alice.id, expiresIn: -5, issuer: 'tictactoe-api' });
    await expect(connect({ token: expired })).rejects.toMatchObject({ data: { code: 'TOKEN_EXPIRED' } });
  });

  it('non-members cannot join, observe, move in or forfeit someone elses game', async () => {
    const { gameId, x } = await matchOverSockets();
    const eve = await registerUser(env.app, 'eve_x');
    const se = await connect(eve);
    const j = await se.emit('game:join', { gameId });
    expect(j).toMatchObject({ ok: false, error: { code: 'NOT_A_PLAYER' } });
    const m = await se.emit('game:move', { gameId, position: 0 });
    expect(m).toMatchObject({ ok: false, error: { code: 'NOT_A_PLAYER' } });
    const rejected = await se.waitFor('game:move-rejected', (p) => p.gameId === gameId);
    expect(rejected.code).toBe('NOT_A_PLAYER');
    expect(await se.emit('game:forfeit', { gameId })).toMatchObject({ ok: false, error: { code: 'NOT_A_PLAYER' } });
    // eve never receives game broadcasts
    await x.emit('game:move', { gameId, position: 0 });
    await sleep(150);
    expect(se.history.some((h) => h.event === 'game:updated')).toBe(false);
  });

  it('validates every payload (bad ids, bad positions, unknown shapes)', async () => {
    const sa = await connect(alice);
    expect(await sa.emit('game:move', { gameId: 'nope', position: 1 })).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await sa.emit('game:move', { gameId: '0'.repeat(24), position: 99 })).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await sa.emit('matchmaking:join', { boardSize: 9 })).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await sa.emit('room:join', { code: '12' })).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await sa.emit('game:join', { gameId: { $ne: null } })).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(await sa.emit('game:join', { gameId: '0'.repeat(24) })).toMatchObject({ ok: false, error: { code: 'GAME_NOT_FOUND' } });
  });

  it('rate limits floods of events', async () => {
    const { TokenBucket } = await import('../../src/sockets/rateLimiter.js');
    const bucket = new TokenBucket(5);
    const taken = Array.from({ length: 20 }, () => bucket.take()).filter(Boolean).length;
    expect(taken).toBe(5);
    expect(bucket.violations).toBe(15);
  });
});

describe('quick match + live synchronisation', () => {
  it('matches two players, synchronises moves in real time and finishes with a verified winner', async () => {
    const { x, o, gameId, xUser, oUser } = await matchOverSockets();

    // X moves -> both sockets get game:updated with the same authoritative board
    const updX = x.next('game:updated');
    const updO = o.next('game:updated');
    const ack = await x.emit('game:move', { gameId, position: 4, clientMoveId: 'move-0000-0001' });
    expect(ack.ok).toBe(true);
    const [ux, uo] = await Promise.all([updX, updO]);
    expect(ux.game.board).toEqual(uo.game.board);
    expect(ux.game.board[4]).toBe('X');
    expect(ux.game.currentTurn).toBe('O');
    expect(uo.lastMove).toMatchObject({ position: 4, mark: 'X', moveNumber: 1, playerId: xUser.id });

    // wrong turn is rejected with a dedicated event, board unchanged
    const bad = await x.emit('game:move', { gameId, position: 0 });
    expect(bad).toMatchObject({ ok: false, error: { code: 'NOT_YOUR_TURN' } });
    expect((await x.waitFor('game:move-rejected', (p) => p.code === 'NOT_YOUR_TURN')).position).toBe(0);
    // occupied
    expect((await o.emit('game:move', { gameId, position: 4 })).error!.code).toBe('CELL_OCCUPIED');

    // duplicate event (same clientMoveId) is acknowledged but not applied twice
    const dup = await x.emit('game:move', { gameId, position: 4, clientMoveId: 'move-0000-0001' }).catch((e) => e);
    expect(dup.ok === true || dup.error?.code === 'NOT_YOUR_TURN').toBe(true);
    expect((await GameModel.findById(gameId).lean())!.moveCount).toBe(1);

    // finish: X takes the 0,4,8 diagonal
    const finishedX = x.waitFor('game:finished');
    const finishedO = o.waitFor('game:finished');
    await o.emit('game:move', { gameId, position: 1 });
    await x.emit('game:move', { gameId, position: 0 });
    await o.emit('game:move', { gameId, position: 2 });
    await x.emit('game:move', { gameId, position: 8 });
    const [fx, fo] = await Promise.all([finishedX, finishedO]);
    expect(fx.game.result).toMatchObject({ winner: 'X', winnerId: xUser.id, reason: 'LINE', line: [0, 4, 8] });
    expect(fo.game.status).toBe('COMPLETED');
    // the finished event is emitted AFTER finalization: it already carries each player's outcome and points
    const outcomes = Object.fromEntries(fx.game.players.map((p: { mark: string; outcome: string; pointsAwarded: number }) => [p.mark, p]));
    expect(outcomes.X).toMatchObject({ outcome: 'WIN' });
    expect(outcomes.X.pointsAwarded).toBeGreaterThan(0);
    expect(outcomes.O.outcome).toBe('LOSS');
    expect((await x.emit('game:move', { gameId, position: 3 })).error!.code).toBe('GAME_NOT_ACTIVE');

    const stats = (await api().get('/api/v1/statistics/me').set(auth(xUser))).body.data;
    expect(stats).toMatchObject({ totalGames: 1, wins: 1 });
    expect((await api().get('/api/v1/statistics/me').set(auth(oUser))).body.data).toMatchObject({ totalGames: 1, losses: 1 });
  });

  it('broadcasts draws with game:draw', async () => {
    const { x, o, gameId } = await matchOverSockets();
    const drawX = x.waitFor('game:draw');
    const drawO = o.waitFor('game:draw');
    for (const [who, pos] of [[x, 0], [o, 1], [x, 2], [o, 4], [x, 3], [o, 5], [x, 7], [o, 6], [x, 8]] as const) {
      expect((await who.emit('game:move', { gameId, position: pos })).ok).toBe(true);
    }
    const [dx] = await Promise.all([drawX, drawO]);
    expect(dx.game.status).toBe('DRAW');
    expect(dx.game.players.every((p: { outcome: string }) => p.outcome === 'DRAW')).toBe(true);
  });

  it('supports several simultaneous matches without cross-talk', async () => {
    const carol = await registerUser(env.app, 'carol');
    const dave = await registerUser(env.app, 'dave_');
    const sc = await connect(carol);
    const sd = await connect(dave);
    const { gameId: g1, x } = await matchOverSockets();
    await sc.emit('matchmaking:join', { boardSize: 4 });
    const found = sd.waitFor('matchmaking:found');
    await sd.emit('matchmaking:join', { boardSize: 4 });
    const f = await found;
    expect(f.gameId).not.toBe(g1);
    await sc.emit('game:join', { gameId: f.gameId });
    await sd.emit('game:join', { gameId: f.gameId });
    await x.emit('game:move', { gameId: g1, position: 0 });
    await sleep(100);
    expect(sc.history.filter((h) => h.event === 'game:updated' && h.payload.game.id === g1)).toHaveLength(0);
    expect(f.game.boardSize).toBe(4);
  });

  it('cancels matchmaking and prevents queueing twice', async () => {
    const sa = await connect(alice);
    await sa.emit('matchmaking:join', { boardSize: 3 });
    const again = await sa.emit('matchmaking:join', { boardSize: 3 });
    expect(again.data.alreadyQueued).toBe(true);
    const cancelled = sa.waitFor('matchmaking:cancelled');
    expect((await sa.emit('matchmaking:cancel')).data.cancelled).toBe(true);
    expect((await cancelled).reason).toBe('CANCELLED');
  });
});

describe('disconnection, reconnection and resume', () => {
  it('notifies the opponent, restores the exact state on reconnect and clears the disconnect timer', async () => {
    const { sa, sb, gameId, xUser, x } = await matchOverSockets();
    await x.emit('game:move', { gameId, position: 4 });

    const gone = (xUser.id === alice.id ? sb : sa).waitFor('player:disconnected');
    x.close();
    const dc = await gone;
    expect(dc).toMatchObject({ gameId, userId: xUser.id });
    await sleep(100);
    expect((await GameModel.findById(gameId).lean())!.disconnectedAt!.X).toBeTruthy();

    // reconnect with a brand new socket
    const back = (xUser.id === alice.id ? sb : sa).waitFor('player:reconnected');
    const x2 = await connect(xUser);
    await back;
    const ready = await x2.waitFor('session:ready');
    expect(ready.activeGames).toHaveLength(1);
    expect(ready.activeGames[0].board[4]).toBe('X');
    const resumed = await x2.waitFor('game:updated', (p) => p.resumed === true);
    expect(resumed.game).toMatchObject({ id: gameId, status: 'IN_PROGRESS', currentTurn: 'O', moveCount: 1 });
    expect((await GameModel.findById(gameId).lean())!.disconnectedAt!.X).toBeNull();

    // the resumed socket is back in the room: it receives live updates and can move
    const live = x2.next('game:updated');
    const o = x === sa ? sb : sa;
    await o.emit('game:move', { gameId, position: 0 });
    expect((await live).game.board[0]).toBe('O');
    expect((await x2.emit('game:move', { gameId, position: 8 })).ok).toBe(true);
  });

  it('forfeits a player who stays disconnected past the grace period', async () => {
    const { sa, sb, gameId, xUser, oUser, x, o } = await matchOverSockets();
    await x.emit('game:move', { gameId, position: 0 });
    await o.emit('game:move', { gameId, position: 4 });
    const finished = (x === sa ? sb : sa).waitFor('game:finished');
    x.close();
    await sleep(1300); // DISCONNECT_GRACE_SEC=1 in the test env
    expect((await processGameTimeouts()).disconnected).toBe(1);
    const fin = await finished;
    expect(fin.game.result).toMatchObject({ winner: 'O', winnerId: oUser.id, reason: 'DISCONNECT' });
    expect((await api().get('/api/v1/statistics/me').set(auth(oUser))).body.data.wins).toBe(1);
    expect((await api().get('/api/v1/statistics/me').set(auth(xUser))).body.data.losses).toBe(1);
  });

  it('a reconnect inside the grace period prevents the forfeit', async () => {
    const { gameId, xUser, x } = await matchOverSockets();
    await x.emit('game:move', { gameId, position: 0 });
    x.close();
    await sleep(100);
    await connect(xUser);
    await sleep(1300);
    expect((await processGameTimeouts()).disconnected).toBe(0);
    expect((await GameModel.findById(gameId).lean())!.status).toBe('IN_PROGRESS');
  });

  it('GET /games/active lets a client with no socket find its game', async () => {
    const { gameId, xUser } = await matchOverSockets();
    const res = await api().get('/api/v1/games/active').set(auth(xUser));
    expect(res.body.data.map((g: { id: string }) => g.id)).toEqual([gameId]);
  });
});

describe('rematch over sockets', () => {
  it('requests, notifies the opponent and starts a new game for both when accepted', async () => {
    const { x, o, gameId, xUser, oUser } = await matchOverSockets();
    await x.emit('game:forfeit', { gameId }); // before 2 moves: not counted, but finished
    const requested = o.waitFor('game:rematch-requested');
    expect((await x.emit('game:rematch', { gameId })).data.status).toBe('REQUESTED');
    expect(await requested).toMatchObject({ gameId, requestedBy: xUser.id });
    const accX = x.waitFor('game:rematch-accepted');
    const accO = o.waitFor('game:rematch-accepted');
    const startedO = o.waitFor('game:started', (p) => p.game.id !== gameId);
    const res = await o.emit('game:rematch', { gameId });
    expect(res.data.status).toBe('STARTED');
    const [ax, ao] = await Promise.all([accX, accO]);
    expect(ax.game.id).toBe(ao.game.id);
    expect(ax.previousGameId).toBe(gameId);
    const st = await startedO;
    expect(st.game.status).toBe('IN_PROGRESS');
    const nextX = st.game.players.find((p: { mark: string }) => p.mark === 'X').userId;
    expect(nextX).toBe(oUser.id); // marks swapped
    // both can play the new game straight away
    const mover = nextX === alice.id ? (x === undefined ? o : (xUser.id === alice.id ? x : o)) : (xUser.id === bob.id ? x : o);
    expect((await mover.emit('game:move', { gameId: st.game.id, position: 0 })).ok).toBe(true);
  });
});

describe('private rooms over sockets', () => {
  it('room:create / room:join emit room events, host starts, both receive the game', async () => {
    const sa = await connect(alice);
    const sb = await connect(bob);
    const created = sa.waitFor('room:created');
    const res = await sa.emit('room:create', { boardSize: 3 });
    expect(res.ok).toBe(true);
    expect((await created).room.code).toBe(res.data.code);

    const updated = sa.waitFor('room:updated', (p) => p.room.status === 'FULL');
    const joined = await sb.emit('room:join', { code: res.data.code });
    expect(joined.data.status).toBe('FULL');
    expect((await updated).room.guest.username).toBe('bobby');

    const ready = sa.waitFor('room:updated', (p) => p.room.status === 'READY');
    await sb.emit('room:ready', { roomId: res.data.id, ready: true });
    await ready;

    // non-host cannot start
    expect((await sb.emit('room:start', { roomId: res.data.id })).error!.code).toBe('NOT_HOST');
    const playing = sb.waitFor('room:updated', (p) => p.room.status === 'PLAYING');
    const start = await sa.emit('room:start', { roomId: res.data.id });
    expect(start.ok).toBe(true);
    const room = (await playing).room;
    expect(room.gameId).toBe(start.data.game.id);

    const startedA = sa.waitFor('game:started');
    await sa.emit('game:join', { gameId: room.gameId });
    await sb.emit('game:join', { gameId: room.gameId });
    expect((await startedA).game.type).toBe('PRIVATE_ROOM');
  });

  it('notifies the host in real time and expires the room for everyone when the host leaves', async () => {
    const sa = await connect(alice);
    const sb = await connect(bob);
    const room = (await sa.emit('room:create', { boardSize: 4, winLength: 3 })).data;
    expect(room).toMatchObject({ boardSize: 4, winLength: 3 });
    const notif = sa.waitFor('notification:new', (n) => n.type === 'OPPONENT_JOINED');
    await sb.emit('room:join', { code: room.code });
    expect((await notif).title).toBe('Player joined');
    expect((await sb.emit('room:leave', { roomId: room.id })).data).toMatchObject({ status: 'WAITING', guestId: null });
    const gone = await sa.emit('room:leave', { roomId: room.id });
    expect(gone.data.status).toBe('EXPIRED'); // the last member leaving cancels the room
  });
});

describe('friends, invites and notifications in real time', () => {
  it('delivers friend requests live, shows online status and lets a friend invite to a game', async () => {
    const sb = await connect(bob);
    const incoming = sb.waitFor('notification:new', (n) => n.type === 'FRIEND_REQUEST');
    const fr = await api().post('/api/v1/friends/request').set(auth(alice)).send({ username: 'bobby' });
    expect(fr.status).toBe(201);
    expect((await incoming).data.fromUserId).toBe(alice.id);

    const sa = await connect(alice);
    const accepted = sa.waitFor('notification:new', (n) => n.type === 'FRIEND_ACCEPTED');
    await api().post(`/api/v1/friends/${fr.body.data.id}/accept`).set(auth(bob));
    expect((await accepted).title).toMatch(/accepted/i);

    const list = await api().get('/api/v1/friends').set(auth(alice));
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].user).toMatchObject({ username: 'bobby', online: true });

    // friend game invite: bob receives it live and accepts via game:join
    const invite = sb.waitFor('notification:new', (n) => n.type === 'GAME_INVITE');
    const g = await api().post('/api/v1/games').set(auth(alice)).send({ type: 'FRIEND', boardSize: 3, opponentId: bob.id });
    expect(g.status).toBe(201);
    expect((await invite).data.gameId).toBe(g.body.data.id);
    const started = sa.waitFor('game:started');
    const joined = await sb.emit('game:join', { gameId: g.body.data.id });
    expect(joined.data.status).toBe('READY');
    await sa.emit('game:join', { gameId: g.body.data.id });
    expect((await started).game.type).toBe('FRIEND');
  });

  it('pushes only to users without an active socket', async () => {
    const { pushSink } = await import('../../src/services/push.service.js');
    const pushed: string[] = [];
    pushSink.fn = (uid) => pushed.push(uid);
    try {
      await connect(bob); // bob is online -> real-time only
      await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: bob.id });
      await sleep(100);
      expect(pushed).toEqual([]);
      sockets.splice(0).forEach((s) => s.close());
      await sleep(150);
      const carol = await registerUser(env.app, 'carol');
      await api().post('/api/v1/friends/request').set(auth(alice)).send({ userId: carol.id }); // carol offline -> push
      await sleep(100);
      expect(pushed).toEqual([carol.id]);
    } finally {
      pushSink.fn = null;
    }
  });
});
