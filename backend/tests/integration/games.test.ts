import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GameModel, MoveModel, UserModel, LeaderboardEntryModel, UserAchievementModel } from '../../src/models/index.js';
import { finalizeGame } from '../../src/services/finalize.service.js';
import { processGameTimeouts } from '../../src/services/game.service.js';
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
const move = (u: TestUser, gameId: string, body: object) => api().post(`/api/v1/games/${gameId}/moves`).set(auth(u)).send(body);

describe('online game: move validation', () => {
  it('assigns X/O, starts only after both join, and enforces turns', async () => {
    await api().post('/api/v1/matchmaking/join').set(auth(alice)).send({ boardSize: 3 });
    const m = await api().post('/api/v1/matchmaking/join').set(auth(bob)).send({ boardSize: 3 });
    expect(m.body.data.status).toBe('MATCHED');
    const g = m.body.data.game;
    expect(g.status).toBe('READY');
    expect(g.players.map((p: { mark: string }) => p.mark).sort()).toEqual(['O', 'X']);
    const x = g.players.find((p: { mark: string }) => p.mark === 'X').userId === alice.id ? alice : bob;
    // moves before start are rejected
    expect((await move(x, g.id, { position: 0 })).body.error.code).toBe('GAME_NOT_ACTIVE');
    await api().post(`/api/v1/games/${g.id}/join`).set(auth(alice));
    const started = await api().post(`/api/v1/games/${g.id}/join`).set(auth(bob));
    expect(started.body.data.status).toBe('IN_PROGRESS');
    expect(started.body.data.currentTurn).toBe('X');
  });

  it('accepts a valid move and rejects wrong turn, occupied cell, out-of-range and strangers', async () => {
    const { gameId, x, o } = await startOnlineGame(env.app, alice, bob);
    const wrongTurn = await move(o, gameId, { position: 0 });
    expect(wrongTurn.status).toBe(409);
    expect(wrongTurn.body.error.code).toBe('NOT_YOUR_TURN');

    const ok = await move(x, gameId, { position: 4 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.game.board[4]).toBe('X');
    expect(ok.body.data.game.currentTurn).toBe('O');
    expect(ok.body.data.move.moveNumber).toBe(1);

    const occupied = await move(o, gameId, { position: 4 });
    expect(occupied.status).toBe(409);
    expect(occupied.body.error.code).toBe('CELL_OCCUPIED');
    expect((await move(o, gameId, { position: 9 })).status).toBe(400); // schema: max 24
    expect((await move(o, gameId, { position: 20 })).body.error.code).toBe('CELL_OUT_OF_RANGE'); // valid for 5x5 only
    expect((await move(o, gameId, { position: -1 })).status).toBe(400);
    expect((await move(o, gameId, { position: 1.5 })).status).toBe(400);

    const stranger = await registerUser(env.app, 'strange');
    const sm = await move(stranger, gameId, { position: 0 });
    expect(sm.status).toBe(403);
    expect(sm.body.error.code).toBe('NOT_A_PLAYER');
    expect((await api().get(`/api/v1/games/${gameId}`).set(auth(stranger))).status).toBe(403);

    // board in DB is exactly what was accepted
    const db = await GameModel.findById(gameId).lean();
    expect(db!.board.filter(Boolean)).toHaveLength(1);
    expect(db!.moveCount).toBe(1);
  });

  it('is idempotent for duplicate submissions (same clientMoveId)', async () => {
    const { gameId, x } = await startOnlineGame(env.app, alice, bob);
    const body = { position: 0, clientMoveId: 'abcd-1234-efgh' };
    const first = await move(x, gameId, body);
    const second = await move(x, gameId, body);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);
    expect(second.body.data.move.moveNumber).toBe(1);
    expect(await MoveModel.countDocuments({ gameId })).toBe(1);
    expect((await GameModel.findById(gameId).lean())!.moveCount).toBe(1);
  });

  it('lets exactly one of many simultaneous conflicting moves through', async () => {
    const { gameId, x } = await startOnlineGame(env.app, alice, bob);
    const results = await Promise.all([0, 1, 2, 3, 4, 5].map((p) => move(x, gameId, { position: p, clientMoveId: `race-${p}-00000` })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    for (const r of results.filter((r) => r.status !== 200)) {
      expect(r.status).toBe(409);
      expect(['NOT_YOUR_TURN', 'MOVE_CONFLICT']).toContain(r.body.error.code);
    }
    const db = await GameModel.findById(gameId).lean();
    expect(db!.moveCount).toBe(1);
    expect(db!.board.filter(Boolean)).toHaveLength(1);
    expect(await MoveModel.countDocuments({ gameId })).toBe(1);
  });

  it('rejects stale optimistic expectedMoveNumber with MOVE_CONFLICT', async () => {
    const { gameId, x } = await startOnlineGame(env.app, alice, bob);
    const res = await move(x, gameId, { position: 0, expectedMoveNumber: 3 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MOVE_CONFLICT');
  });
});

describe('win / draw detection and result persistence', () => {
  it.each([
    ['horizontal', [0, 3, 1, 4, 2], [0, 1, 2]],
    ['vertical', [0, 1, 3, 2, 6], [0, 3, 6]],
    ['diagonal', [0, 1, 4, 2, 8], [0, 4, 8]],
    ['anti-diagonal', [2, 0, 4, 1, 6], [2, 4, 6]],
  ])('detects a %s win for X', async (_n, positions, line) => {
    const { gameId, x, o } = await startOnlineGame(env.app, alice, bob);
    const seq: Array<[TestUser, number]> = positions.map((p, i) => [i % 2 === 0 ? x : o, p]);
    const last = await playMoves(env.app, gameId, seq);
    const g = last.body.data.game;
    expect(g.status).toBe('COMPLETED');
    expect(g.result).toMatchObject({ winner: 'X', winnerId: x.id, reason: 'LINE', line });
    // no further moves
    expect((await move(o, gameId, { position: 8 })).body.error.code).toBe('GAME_NOT_ACTIVE');
  });

  it('detects a draw and records it once for both players', async () => {
    const { gameId, x, o } = await startOnlineGame(env.app, alice, bob);
    // X O X / X O O / O X X
    const order = [0, 1, 2, 4, 3, 5, 7, 6, 8];
    const last = await playMoves(env.app, gameId, order.map((p, i) => [i % 2 === 0 ? x : o, p] as [TestUser, number]));
    expect(last.body.data.game.status).toBe('DRAW');
    expect(last.body.data.game.result.reason).toBe('DRAW');
    for (const u of [x, o]) {
      const me = await api().get('/api/v1/statistics/me').set(auth(u));
      expect(me.body.data).toMatchObject({ totalGames: 1, draws: 1, wins: 0, losses: 0 });
    }
  });

  it('updates statistics, points, level inputs, streaks, history and replay exactly once', async () => {
    const { gameId, x, o } = await startOnlineGame(env.app, alice, bob);
    await playMoves(env.app, gameId, [[x, 0], [o, 3], [x, 1], [o, 4], [x, 2]]);

    const sx = (await api().get('/api/v1/statistics/me').set(auth(x))).body.data;
    const so = (await api().get('/api/v1/statistics/me').set(auth(o))).body.data;
    expect(sx).toMatchObject({ totalGames: 1, wins: 1, losses: 0, winPercentage: 100, points: 25, xp: expect.any(Number), currentStreak: 1, bestStreak: 1, onlineWins: 1 });
    expect(so).toMatchObject({ totalGames: 1, wins: 0, losses: 1, winPercentage: 0, points: 3, currentStreak: 0 });

    // Calling the finalizer again (retries/duplicate events) must not change anything.
    expect(await finalizeGame(gameId)).toEqual({ applied: false });
    expect(await finalizeGame(gameId)).toEqual({ applied: false });
    const concurrent = await Promise.all([1, 2, 3, 4].map(() => finalizeGame(gameId)));
    expect(concurrent.every((r) => !r.applied)).toBe(true);
    const again = (await api().get('/api/v1/statistics/me').set(auth(x))).body.data;
    expect(again.totalGames).toBe(1);
    expect(again.points).toBe(sx.points);

    const hist = await api().get('/api/v1/statistics/me/history').set(auth(x));
    expect(hist.body.data).toHaveLength(1);
    expect(hist.body.data[0]).toMatchObject({ id: gameId, result: 'WIN', pointsAwarded: 25, type: 'ONLINE_RANDOM' });
    expect(hist.body.data[0].opponent.username).toBe(o.username);
    const lossHist = await api().get('/api/v1/statistics/me/history?result=LOSS').set(auth(x));
    expect(lossHist.body.data).toHaveLength(0);

    const streaks = await api().get('/api/v1/statistics/me/streaks').set(auth(x));
    expect(streaks.body.data).toMatchObject({ currentStreak: 1, bestStreak: 1, recentForm: ['WIN'] });

    const hmoves = await api().get(`/api/v1/games/${gameId}/history`).set(auth(o));
    expect(hmoves.body.data.map((m: { position: number }) => m.position)).toEqual([0, 3, 1, 4, 2]);
    const replay = await api().get(`/api/v1/games/${gameId}/replay`).set(auth(o));
    expect(replay.body.data.frames).toHaveLength(6);
    expect(replay.body.data.frames[0].board.every((c: string) => c === '')).toBe(true);
    expect(replay.body.data.frames[5].board.filter(Boolean)).toHaveLength(5);

    // per-period leaderboard rows were written once
    expect(await LeaderboardEntryModel.countDocuments({ userId: x.id })).toBe(3);
    const daily = await LeaderboardEntryModel.findOne({ userId: x.id, period: 'daily' }).lean();
    expect(daily).toMatchObject({ points: 25, wins: 1, games: 1 });
  });

  it('a win extends the streak, a loss resets it, a draw leaves it untouched', async () => {
    // `winner` wins because the opponent forfeits after both sides have moved (counts as a real result).
    const winBy = async (winner: TestUser, loser: TestUser) => {
      const { gameId, x, o } = await startOnlineGame(env.app, winner, loser);
      await playMoves(env.app, gameId, [[x, 0], [o, 4]]);
      await api().post(`/api/v1/games/${gameId}/forfeit`).set(auth(loser));
    };
    const streak = async (u: TestUser) => (await api().get('/api/v1/statistics/me/streaks').set(auth(u))).body.data;

    await winBy(alice, bob);
    await winBy(alice, bob);
    expect(await streak(alice)).toMatchObject({ currentStreak: 2, bestStreak: 2 });
    expect(await streak(bob)).toMatchObject({ currentStreak: 0, bestStreak: 0 });

    // a draw: neither extends nor resets
    const { gameId, x, o } = await startOnlineGame(env.app, alice, bob);
    await playMoves(env.app, gameId, [0, 1, 2, 4, 3, 5, 7, 6, 8].map((p, i) => [i % 2 === 0 ? x : o, p] as [TestUser, number]));
    expect(await streak(alice)).toMatchObject({ currentStreak: 2, bestStreak: 2 });

    await winBy(bob, alice); // alice loses -> streak resets but the best streak is kept
    expect(await streak(alice)).toMatchObject({ currentStreak: 0, bestStreak: 2 });
    expect(await streak(bob)).toMatchObject({ currentStreak: 1, bestStreak: 1 });
    expect((await streak(alice)).recentForm).toEqual(['LOSS', 'DRAW', 'WIN', 'WIN']); // newest first
  });
});

describe('forfeit, cancel and timeouts', () => {
  it('forfeit gives the opponent the win', async () => {
    const { gameId, x, o } = await startOnlineGame(env.app, alice, bob);
    await playMoves(env.app, gameId, [[x, 0], [o, 4]]);
    const res = await api().post(`/api/v1/games/${gameId}/forfeit`).set(auth(x));
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.result).toMatchObject({ winner: 'O', winnerId: o.id, reason: 'FORFEIT' });
    expect((await api().get('/api/v1/statistics/me').set(auth(o))).body.data.wins).toBe(1);
    expect((await api().post(`/api/v1/games/${gameId}/forfeit`).set(auth(x))).status).toBe(409);
  });

  it('instant forfeits before both sides moved are not counted (no point farming)', async () => {
    const { gameId, x, o } = await startOnlineGame(env.app, alice, bob);
    await api().post(`/api/v1/games/${gameId}/forfeit`).set(auth(x));
    expect((await api().get('/api/v1/statistics/me').set(auth(o))).body.data.totalGames).toBe(0);
  });

  it('cancelling a game that has not started does not count as a match', async () => {
    await api().post('/api/v1/matchmaking/join').set(auth(alice)).send({ boardSize: 3 });
    const m = await api().post('/api/v1/matchmaking/join').set(auth(bob)).send({ boardSize: 3 });
    const gameId = m.body.data.game.id;
    const res = await api().post(`/api/v1/games/${gameId}/forfeit`).set(auth(alice));
    expect(res.body.data.status).toBe('CANCELLED');
    for (const u of [alice, bob]) expect((await api().get('/api/v1/statistics/me').set(auth(u))).body.data.totalGames).toBe(0);
    // both are free to queue again
    expect((await api().post('/api/v1/matchmaking/join').set(auth(alice)).send({ boardSize: 3 })).status).toBe(200);
  });

  it('turn timeout ends the game: the player who did not move loses', async () => {
    const { gameId, x, o } = await startOnlineGame(env.app, alice, bob);
    await playMoves(env.app, gameId, [[x, 0], [o, 4], [x, 1]]);
    await GameModel.updateOne({ _id: gameId }, { $set: { turnDeadline: new Date(Date.now() - 1000) } });
    const out = await processGameTimeouts();
    expect(out.timedOut).toBe(1);
    const g = (await api().get(`/api/v1/games/${gameId}`).set(auth(x))).body.data;
    expect(g.status).toBe('COMPLETED');
    expect(g.result).toMatchObject({ winner: 'X', winnerId: x.id, reason: 'TIMEOUT' });
    expect((await api().get('/api/v1/statistics/me').set(auth(x))).body.data.wins).toBe(1);
  });

  it('unstarted READY games are cancelled by the janitor', async () => {
    await api().post('/api/v1/matchmaking/join').set(auth(alice)).send({ boardSize: 3 });
    const m = await api().post('/api/v1/matchmaking/join').set(auth(bob)).send({ boardSize: 3 });
    // createdAt is immutable in mongoose, so go through the raw driver
    await GameModel.collection.updateOne({ _id: new Types.ObjectId(m.body.data.game.id) }, { $set: { createdAt: new Date(Date.now() - 120_000) } });
    expect((await processGameTimeouts()).expired).toBe(1);
    expect((await GameModel.findById(m.body.data.game.id).lean())!.status).toBe('CANCELLED');
  });
});

describe('AI games (server-run opponent)', () => {
  it('plays a full game vs the AI; the AI never makes an invalid move; stats count once', async () => {
    const created = await api().post('/api/v1/games').set(auth(alice)).send({ type: 'AI', boardSize: 3, difficulty: 'HARD', humanMark: 'X' });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(created.body.data.status).toBe('IN_PROGRESS');
    let game = created.body.data;
    for (let i = 0; i < 9 && game.status === 'IN_PROGRESS'; i++) {
      const free = game.board.map((c: string, idx: number) => (c === '' ? idx : -1)).filter((n: number) => n >= 0);
      const res = await move(alice, id, { position: free[0] });
      expect(res.status).toBe(200);
      game = res.body.data.game;
      if (game.status === 'IN_PROGRESS') expect(game.currentTurn).toBe('X');
    }
    expect(['COMPLETED', 'DRAW']).toContain(game.status);
    const stats = (await api().get('/api/v1/statistics/me').set(auth(alice))).body.data;
    expect(stats).toMatchObject({ totalGames: 1, aiGames: 1 });
    expect((await api().post(`/api/v1/games/${id}/forfeit`).set(auth(alice))).status).toBe(409);
  });

  it('AI moves first when the human picks O, and impossible AI never loses', async () => {
    const created = await api().post('/api/v1/games').set(auth(alice)).send({ type: 'AI', boardSize: 3, difficulty: 'IMPOSSIBLE', humanMark: 'O' });
    expect(created.body.data.board.filter(Boolean)).toHaveLength(1);
    expect(created.body.data.currentTurn).toBe('O');
    let game = created.body.data;
    while (game.status === 'IN_PROGRESS') {
      const free = game.board.map((c: string, idx: number) => (c === '' ? idx : -1)).filter((n: number) => n >= 0);
      const res = await move(alice, game.id, { position: free[free.length - 1] });
      game = res.body.data.game;
    }
    expect(game.status === 'DRAW' || game.result.winner === 'X').toBe(true);
  });

  it('supports 4x4 and 5x5 boards with a configurable win length and validates configs', async () => {
    const g5 = await api().post('/api/v1/games').set(auth(alice)).send({ type: 'AI', boardSize: 5, winLength: 5, difficulty: 'EASY' });
    expect(g5.body.data).toMatchObject({ boardSize: 5, winLength: 5 });
    expect(g5.body.data.board).toHaveLength(25);
    const g4 = await api().post('/api/v1/games').set(auth(alice)).send({ type: 'AI', boardSize: 4, difficulty: 'EASY' });
    expect(g4.body.data).toMatchObject({ boardSize: 4, winLength: 4 });
    expect((await api().post('/api/v1/games').set(auth(alice)).send({ type: 'AI', boardSize: 3, winLength: 5, difficulty: 'EASY' })).body.error.code).toBe('INVALID_BOARD_CONFIG');
    expect((await api().post('/api/v1/games').set(auth(alice)).send({ type: 'AI', boardSize: 6, difficulty: 'EASY' })).status).toBe(400);
  });

  it('AI rematch restarts immediately with swapped marks', async () => {
    const created = await api().post('/api/v1/games').set(auth(alice)).send({ type: 'AI', boardSize: 3, difficulty: 'EASY', humanMark: 'X' });
    await api().post(`/api/v1/games/${created.body.data.id}/forfeit`).set(auth(alice));
    const rm = await api().post(`/api/v1/games/${created.body.data.id}/rematch`).set(auth(alice));
    expect(rm.body.data.status).toBe('STARTED');
    expect(rm.body.data.game.players.find((p: { userId: string }) => p.userId === alice.id).mark).toBe('O');
    const again = await api().post(`/api/v1/games/${created.body.data.id}/rematch`).set(auth(alice));
    expect(again.body.data.game.id).toBe(rm.body.data.game.id); // idempotent
  });
});

describe('online rematch', () => {
  it('starts a new game with swapped marks only after both players ask', async () => {
    const { gameId, x, o } = await startOnlineGame(env.app, alice, bob);
    await playMoves(env.app, gameId, [[x, 0], [o, 3], [x, 1], [o, 4], [x, 2]]);
    const early = await api().post(`/api/v1/games/${gameId}/rematch`).set(auth(x));
    expect(early.body.data.status).toBe('REQUESTED');
    const dup = await api().post(`/api/v1/games/${gameId}/rematch`).set(auth(x));
    expect(dup.body.data.status).toBe('REQUESTED');
    const ok = await api().post(`/api/v1/games/${gameId}/rematch`).set(auth(o));
    expect(ok.body.data.status).toBe('STARTED');
    const ng = ok.body.data.game;
    expect(ng.status).toBe('IN_PROGRESS');
    expect(ng.previousGameId).toBe(gameId);
    expect(ng.players.find((p: { userId: string }) => p.userId === x.id).mark).toBe('O');
    // concurrent rematch accepts never create two games
    const again = await api().post(`/api/v1/games/${gameId}/rematch`).set(auth(x));
    expect(again.body.data.game.id).toBe(ng.id);
    expect(await GameModel.countDocuments({ previousGameId: gameId })).toBe(1);
    expect((await api().post(`/api/v1/games/${ng.id}/rematch`).set(auth(x))).status).toBe(409); // not finished
  });
});

describe('matchmaking queue', () => {
  it('prevents duplicate queueing, supports cancel, never matches a user with themselves or blocked users', async () => {
    const a1 = await api().post('/api/v1/matchmaking/join').set(auth(alice)).send({ boardSize: 3 });
    expect(a1.body.data.status).toBe('QUEUED');
    const a2 = await api().post('/api/v1/matchmaking/join').set(auth(alice)).send({ boardSize: 3 });
    expect(a2.body.data).toMatchObject({ status: 'QUEUED', alreadyQueued: true });
    expect(a2.body.data.ticket.id).toBe(a1.body.data.ticket.id);
    expect((await api().get('/api/v1/matchmaking/status').set(auth(alice))).body.data.queued).toBe(true);
    expect((await api().post('/api/v1/matchmaking/cancel').set(auth(alice))).body.data.cancelled).toBe(true);
    expect((await api().get('/api/v1/matchmaking/status').set(auth(alice))).body.data.queued).toBe(false);
    expect((await api().post('/api/v1/matchmaking/cancel').set(auth(alice))).body.data.cancelled).toBe(false);

    await api().post(`/api/v1/friends/${alice.id}/block`).set(auth(bob));
    await api().post('/api/v1/matchmaking/join').set(auth(alice)).send({ boardSize: 3 });
    const b = await api().post('/api/v1/matchmaking/join').set(auth(bob)).send({ boardSize: 3 });
    expect(b.body.data.status).toBe('QUEUED'); // blocked pair is never matched
  });

  it('only pairs identical board configurations and expires stale tickets', async () => {
    await api().post('/api/v1/matchmaking/join').set(auth(alice)).send({ boardSize: 4 });
    const b = await api().post('/api/v1/matchmaking/join').set(auth(bob)).send({ boardSize: 3 });
    expect(b.body.data.status).toBe('QUEUED');
    const { MatchmakingTicketModel } = await import('../../src/models/index.js');
    await MatchmakingTicketModel.updateMany({}, { $set: { queueExpiresAt: new Date(Date.now() - 1000) } });
    const { sweep } = await import('../../src/matchmaking/matchmaking.service.js');
    expect((await sweep()).expired).toBe(2);
    expect(await MatchmakingTicketModel.countDocuments({ status: 'EXPIRED' })).toBe(2);
  });

  it('many simultaneous joins never pair a ticket twice', async () => {
    const users = await Promise.all(Array.from({ length: 8 }, (_, i) => registerUser(env.app, `mass${i}`)));
    await Promise.all(users.map((u) => api().post('/api/v1/matchmaking/join').set(auth(u)).send({ boardSize: 3 })));
    // let the sweeper pair anyone left over
    const { sweep } = await import('../../src/matchmaking/matchmaking.service.js');
    await sweep();
    const games = await GameModel.find({ type: 'ONLINE_RANDOM' }).lean();
    const seen = new Set<string>();
    for (const g of games) for (const id of g.playerIds) {
      expect(seen.has(String(id))).toBe(false);
      seen.add(String(id));
    }
    expect(games.length).toBe(4);
  });
});

describe('private rooms (REST)', () => {
  it('create -> join by code -> ready -> start -> play -> rematch in the same room', async () => {
    const created = await api().post('/api/v1/rooms').set(auth(alice)).send({ boardSize: 3 });
    expect(created.status).toBe(201);
    const room = created.body.data;
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(room.status).toBe('WAITING');

    expect((await api().post('/api/v1/rooms/join').set(auth(alice)).send({ code: room.code })).body.data.id).toBe(room.id); // own room: idempotent
    expect((await api().post('/api/v1/rooms/join').set(auth(bob)).send({ code: 'ZZZZZZ' })).body.error.code).toBe('ROOM_NOT_FOUND');
    const joined = await api().post('/api/v1/rooms/join').set(auth(bob)).send({ code: room.code.toLowerCase() });
    expect(joined.body.data.status).toBe('FULL');

    const carol = await registerUser(env.app, 'carol');
    const full = await api().post('/api/v1/rooms/join').set(auth(carol)).send({ code: room.code });
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('ROOM_FULL');
    expect((await api().get(`/api/v1/rooms/${room.id}`).set(auth(carol))).status).toBe(403);

    expect((await api().post(`/api/v1/rooms/${room.id}/start`).set(auth(alice))).body.error.code).toBe('ROOM_NOT_READY');
    expect((await api().post(`/api/v1/rooms/${room.id}/ready`).set(auth(alice)).send({ ready: true })).body.error.code).toBe('HOST_ALWAYS_READY');
    expect((await api().post(`/api/v1/rooms/${room.id}/ready`).set(auth(bob)).send({ ready: true })).body.data.status).toBe('READY');
    expect((await api().post(`/api/v1/rooms/${room.id}/start`).set(auth(bob))).body.error.code).toBe('NOT_HOST');

    const started = await api().post(`/api/v1/rooms/${room.id}/start`).set(auth(alice));
    expect(started.status).toBe(200);
    expect(started.body.data.room.status).toBe('PLAYING');
    const gameId = started.body.data.game.id;
    expect((await api().post(`/api/v1/rooms/${room.id}/start`).set(auth(alice))).status).toBe(409); // no double start

    await api().post(`/api/v1/games/${gameId}/join`).set(auth(alice));
    const g = (await api().post(`/api/v1/games/${gameId}/join`).set(auth(bob))).body.data;
    expect(g.type).toBe('PRIVATE_ROOM');
    const x = g.players.find((p: { mark: string }) => p.mark === 'X').userId === alice.id ? alice : bob;
    const o = x === alice ? bob : alice;
    await playMoves(env.app, gameId, [[x, 0], [o, 3], [x, 1], [o, 4], [x, 2]]);
    expect((await api().get(`/api/v1/rooms/${room.id}`).set(auth(alice))).body.data.status).toBe('COMPLETED');

    await api().post(`/api/v1/games/${gameId}/rematch`).set(auth(alice));
    const rm = await api().post(`/api/v1/games/${gameId}/rematch`).set(auth(bob));
    expect(rm.body.data.game.roomId).toBe(room.id);
    const roomNow = (await api().get(`/api/v1/rooms/${room.id}`).set(auth(alice))).body.data;
    expect(roomNow).toMatchObject({ status: 'PLAYING', gameId: rm.body.data.game.id });
    // private-room wins are worth half the ranked points
    const st = (await api().get('/api/v1/statistics/me').set(auth(x))).body.data;
    expect(st.points).toBe(13);
  });

  it('host leaving promotes the guest; the last member leaving cancels the room; rooms expire', async () => {
    const room = (await api().post('/api/v1/rooms').set(auth(alice)).send({ boardSize: 5 })).body.data;
    await api().post('/api/v1/rooms/join').set(auth(bob)).send({ code: room.code });
    const left = await api().post(`/api/v1/rooms/${room.id}/leave`).set(auth(alice));
    expect(left.body.data).toMatchObject({ status: 'WAITING', hostId: bob.id, guestId: null });
    const gone = await api().post(`/api/v1/rooms/${room.id}/leave`).set(auth(bob));
    expect(gone.body.data.status).toBe('EXPIRED');
    expect((await api().post('/api/v1/rooms/join').set(auth(alice)).send({ code: room.code })).status).toBe(410);

    const r2 = (await api().post('/api/v1/rooms').set(auth(alice)).send({ boardSize: 3 })).body.data;
    const { RoomModel } = await import('../../src/models/index.js');
    await RoomModel.updateOne({ _id: r2.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const { expireRooms } = await import('../../src/services/room.service.js');
    expect(await expireRooms()).toBe(1);
    expect((await api().post('/api/v1/rooms/join').set(auth(bob)).send({ code: r2.code })).status).toBe(410);
    expect(await UserModel.countDocuments()).toBe(2);
  });
});

describe('achievements & levels', () => {
  it('unlocks First Victory exactly once, grants XP and level, and notifies', async () => {
    const run = async () => {
      const { gameId, x, o } = await startOnlineGame(env.app, alice, bob);
      await playMoves(env.app, gameId, [[x, 0], [o, 3], [x, 1], [o, 4], [x, 2]]);
      return x;
    };
    const winner = await run();
    const mine = await api().get('/api/v1/achievements/me').set(auth(winner));
    const first = mine.body.data.items.find((a: { key: string }) => a.key === 'FIRST_VICTORY');
    expect(first).toMatchObject({ unlocked: true, progress: 1, target: 1 });
    const perfect = mine.body.data.items.find((a: { key: string }) => a.key === 'PERFECT_GAME');
    expect(perfect.unlocked).toBe(true); // won in the minimum 3 moves
    const ten = mine.body.data.items.find((a: { key: string }) => a.key === 'WINS_10');
    expect(ten).toMatchObject({ unlocked: false, progress: 1 });

    const profile = (await api().get('/api/v1/users/me').set(auth(winner))).body.data.stats;
    expect(profile.xp).toBe(25 + 25 + 60); // match points + FIRST_VICTORY + PERFECT_GAME rewards
    expect(profile.level).toBe(2); // level n needs 50*(n-1)^2 XP: 110 XP is >= 50 and < 200
    const notifs = await api().get('/api/v1/notifications').set(auth(winner));
    const types = notifs.body.data.map((n: { type: string }) => n.type);
    expect(types).toContain('ACHIEVEMENT_UNLOCKED');
    expect(await UserAchievementModel.countDocuments({ userId: winner.id, unlockedAt: { $ne: null } })).toBe(2);
    expect((await api().get('/api/v1/achievements').set(auth(winner))).body.data.length).toBeGreaterThanOrEqual(10);
  });
});
