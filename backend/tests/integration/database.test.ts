import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AchievementModel,
  BlockedUserModel,
  DeviceTokenModel,
  FriendshipModel,
  GameModel,
  LeaderboardEntryModel,
  makePairKey,
  MatchmakingTicketModel,
  MoveModel,
  NotificationModel,
  RefreshTokenModel,
  ReportModel,
  RoomModel,
  UserAchievementModel,
  UserModel,
} from '../../src/models/index.js';
import { finalizeGame } from '../../src/services/finalize.service.js';
import { createGameDoc } from '../../src/services/game.service.js';
import { clearDb, Env, startEnv, stopEnv } from '../helpers.js';

let env: Env;
beforeAll(async () => void (env = await startEnv()));
afterAll(async () => stopEnv(env));
beforeEach(clearDb);

const mkUser = (name: string) => UserModel.create({ username: name, usernameLower: name.toLowerCase(), displayName: name, email: `${name}@x.io`, accountType: 'REGISTERED' });
const oid = () => new Types.ObjectId();

describe('schema validation', () => {
  it('rejects invalid users', async () => {
    await expect(UserModel.create({ username: 'ab', usernameLower: 'ab', displayName: 'x' })).rejects.toThrow(/minimum allowed length|shorter/i);
    await expect(UserModel.create({ username: 'bad name!', usernameLower: 'bad name!', displayName: 'x' })).rejects.toThrow();
    await expect(UserModel.create({ username: 'okname', usernameLower: 'okname', displayName: 'x', theme: 'rainbow' })).rejects.toThrow();
    await expect(UserModel.create({ username: 'okname', usernameLower: 'okname', displayName: 'x', sound: { volume: 3 } })).rejects.toThrow();
    await expect(UserModel.create({ username: 'okname', usernameLower: 'okname', displayName: '' })).rejects.toThrow();
  });
  it('applies profile defaults', async () => {
    const u = await mkUser('defaulty');
    expect(u.stats).toMatchObject({ totalGames: 0, wins: 0, points: 0, level: 1, currentStreak: 0, bestStreak: 0 });
    expect(u).toMatchObject({ theme: 'light', language: 'en', online: false, emailVerified: false });
    expect(u.sound).toMatchObject({ effects: true, music: true, volume: 0.8 });
    expect(u.toJSON()).not.toHaveProperty('passwordHash');
  });
  it('rejects invalid games, rooms and notifications', async () => {
    await expect(GameModel.create({ type: 'ONLINE_RANDOM', boardSize: 7, winLength: 3, board: [] })).rejects.toThrow();
    await expect(GameModel.create({ type: 'NOPE', boardSize: 3, winLength: 3, board: [] })).rejects.toThrow();
    await expect(GameModel.create({ type: 'AI', status: 'WEIRD', boardSize: 3, winLength: 3, board: [] })).rejects.toThrow();
    await expect(RoomModel.create({ code: 'AB', hostId: oid(), boardSize: 3, winLength: 3, expiresAt: new Date() })).rejects.toThrow();
    await expect(NotificationModel.create({ userId: oid(), type: 'BOGUS', category: 'game', title: 't', body: 'b', expireAt: new Date() })).rejects.toThrow();
    await expect(DeviceTokenModel.create({ userId: oid(), token: 'x', platform: 'symbian' })).rejects.toThrow();
  });
});

describe('unique constraints', () => {
  it('users: email, username (case-insensitive), social identity', async () => {
    await mkUser('Alpha');
    await expect(mkUser('alpha')).rejects.toMatchObject({ code: 11000 });
    await expect(UserModel.create({ username: 'other', usernameLower: 'other', displayName: 'o', email: 'alpha@x.io' })).rejects.toMatchObject({ code: 11000 });
    // guests without email never collide
    await UserModel.create({ username: 'g_one', usernameLower: 'g_one', displayName: 'g' });
    await UserModel.create({ username: 'g_two', usernameLower: 'g_two', displayName: 'g' });
    await UserModel.create({ username: 'soc1', usernameLower: 'soc1', displayName: 's', providers: [{ provider: 'google', subject: 'abc' }] });
    await expect(UserModel.create({ username: 'soc2', usernameLower: 'soc2', displayName: 's', providers: [{ provider: 'google', subject: 'abc' }] })).rejects.toMatchObject({ code: 11000 });
  });

  it('rooms: unique code; tickets: one QUEUED ticket per user; friendships: one per pair', async () => {
    const h = oid();
    const room = { code: 'ABC234', hostId: h, boardSize: 3, winLength: 3, expiresAt: new Date(Date.now() + 1e6) };
    await RoomModel.create(room);
    await expect(RoomModel.create({ ...room, hostId: oid() })).rejects.toMatchObject({ code: 11000 });

    const t = { userId: h, boardSize: 3, winLength: 3, queueExpiresAt: new Date(Date.now() + 1e6) };
    await MatchmakingTicketModel.create(t);
    await expect(MatchmakingTicketModel.create(t)).rejects.toMatchObject({ code: 11000 });
    await MatchmakingTicketModel.updateMany({ userId: h }, { $set: { status: 'CANCELLED' } });
    await MatchmakingTicketModel.create(t); // allowed again after the first left the queue

    const a = oid();
    const b = oid();
    await FriendshipModel.create({ requesterId: a, recipientId: b, pairKey: makePairKey(a, b) });
    await expect(FriendshipModel.create({ requesterId: b, recipientId: a, pairKey: makePairKey(b, a) })).rejects.toMatchObject({ code: 11000 });
    await BlockedUserModel.create({ blockerId: a, blockedId: b });
    await expect(BlockedUserModel.create({ blockerId: a, blockedId: b })).rejects.toMatchObject({ code: 11000 });
  });

  it('moves: unique move number, cell and idempotency key per game', async () => {
    const g = oid();
    const p = oid();
    await MoveModel.create({ gameId: g, moveNumber: 1, playerId: p, mark: 'X', position: 0, clientMoveId: 'id-000001' });
    await expect(MoveModel.create({ gameId: g, moveNumber: 1, playerId: p, mark: 'O', position: 1 })).rejects.toMatchObject({ code: 11000 });
    await expect(MoveModel.create({ gameId: g, moveNumber: 2, playerId: p, mark: 'O', position: 0 })).rejects.toMatchObject({ code: 11000 });
    await expect(MoveModel.create({ gameId: g, moveNumber: 3, playerId: p, mark: 'X', position: 5, clientMoveId: 'id-000001' })).rejects.toMatchObject({ code: 11000 });
    await MoveModel.create({ gameId: oid(), moveNumber: 1, playerId: p, mark: 'X', position: 0, clientMoveId: 'id-000001' }); // other game: fine
  });

  it('tokens, achievements and leaderboard rows', async () => {
    const u = oid();
    await RefreshTokenModel.create({ userId: u, familyId: 'f', tokenHash: 'h1', expiresAt: new Date(Date.now() + 1e6) });
    await expect(RefreshTokenModel.create({ userId: u, familyId: 'f', tokenHash: 'h1', expiresAt: new Date() })).rejects.toMatchObject({ code: 11000 });
    await UserAchievementModel.create({ userId: u, achievementKey: 'K' });
    await expect(UserAchievementModel.create({ userId: u, achievementKey: 'K' })).rejects.toMatchObject({ code: 11000 });
    const row = { userId: u, period: 'daily', periodKey: '2026-01-01', expireAt: new Date(Date.now() + 1e6) };
    await LeaderboardEntryModel.create(row);
    await expect(LeaderboardEntryModel.create(row)).rejects.toMatchObject({ code: 11000 });
    await DeviceTokenModel.create({ userId: u, token: 't'.repeat(30), platform: 'ios' });
    await expect(DeviceTokenModel.create({ userId: u, token: 't'.repeat(30), platform: 'ios' })).rejects.toMatchObject({ code: 11000 });
    expect(await ReportModel.countDocuments()).toBe(0);
  });
});

describe('indexes', () => {
  const names = async (model: { collection: { indexes(): Promise<Array<{ key: Record<string, unknown>; name?: string; expireAfterSeconds?: number; unique?: boolean }>> } }) =>
    (await model.collection.indexes()).map((i) => ({ key: Object.keys(i.key).join(','), ttl: i.expireAfterSeconds, unique: i.unique }));

  it('exist for every required lookup', async () => {
    const has = (list: Array<{ key: string }>, key: string) => expect(list.some((i) => i.key === key), `missing index ${key}`).toBe(true);
    const users = await names(UserModel);
    ['email', 'usernameLower', 'stats.points,_id', 'stats.wins,_id'].forEach((k) => has(users, k));
    has(await names(RoomModel), 'code');
    const games = await names(GameModel);
    ['status,turnDeadline', 'playerIds,status,createdAt', 'roomId'].forEach((k) => has(games, k));
    const tickets = await names(MatchmakingTicketModel);
    ['userId', 'status,boardSize,winLength,createdAt'].forEach((k) => has(tickets, k));
    has(await names(MoveModel), 'gameId,moveNumber');
    has(await names(LeaderboardEntryModel), 'period,periodKey,points,_id');
    has(await names(NotificationModel), 'userId,createdAt');
    has(await names(FriendshipModel), 'pairKey');
    has(await names(BlockedUserModel), 'blockerId,blockedId');
    has(await names(AchievementModel), 'key');
  });

  it('use TTL indexes for retention', async () => {
    const ttl = async (m: Parameters<typeof names>[0]) => (await names(m)).filter((i) => i.ttl !== undefined).map((i) => i.key);
    expect(await ttl(RefreshTokenModel)).toContain('expiresAt');
    expect(await ttl(NotificationModel)).toContain('expireAt');
    expect(await ttl(DeviceTokenModel)).toContain('lastSeenAt');
    expect(await ttl(GameModel)).toContain('purgeAt');
    expect(await ttl(MoveModel)).toContain('expireAt');
    expect(await ttl(MatchmakingTicketModel)).toContain('purgeAt');
    expect(await ttl(LeaderboardEntryModel)).toContain('expireAt');
    expect(await ttl(RoomModel)).toContain('purgeAt');
  });

  it('has all 14 required collections modelled', () => {
    const cols = Object.values(mongoose.models).map((m) => m.collection.collectionName);
    for (const c of ['users', 'refreshtokens', 'games', 'moves', 'rooms', 'matchmakingtickets', 'friendships', 'achievements', 'userachievements', 'notifications', 'leaderboardentries', 'devicetokens', 'reports', 'blockedusers']) {
      expect(cols).toContain(c);
    }
  });
});

describe('match finalization', () => {
  async function finishedGame(winnerIdx: 0 | 1 | null) {
    const [a, b] = [await mkUser('fin_a'), await mkUser('fin_b')];
    const game = await createGameDoc({ type: 'ONLINE_RANDOM', config: { size: 3, winLength: 3 }, humans: [{ userId: a._id, mark: 'X' }, { userId: b._id, mark: 'O' }], status: 'IN_PROGRESS' });
    const winner = winnerIdx === null ? null : [a, b][winnerIdx]!;
    await GameModel.updateOne(
      { _id: game._id },
      {
        $set: {
          status: winner ? 'COMPLETED' : 'DRAW',
          moveCount: 5,
          endedAt: new Date(),
          durationMs: 42_000,
          'result.winner': winner ? (winnerIdx === 0 ? 'X' : 'O') : null,
          'result.winnerId': winner?._id ?? null,
          'result.reason': winner ? 'LINE' : 'DRAW',
        },
      },
    );
    return { a, b, id: String(game._id) };
  }

  it('applies statistics exactly once even under concurrent finalizers', async () => {
    const { a, b, id } = await finishedGame(0);
    const results = await Promise.all(Array.from({ length: 10 }, () => finalizeGame(id)));
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    const [ua, ub] = [await UserModel.findById(a._id).lean(), await UserModel.findById(b._id).lean()];
    expect(ua!.stats).toMatchObject({ totalGames: 1, wins: 1, losses: 0, points: 25, xp: expect.any(Number), currentStreak: 1, bestStreak: 1, onlineGames: 1, onlineWins: 1, totalPlayTimeSec: 42 });
    expect(ub!.stats).toMatchObject({ totalGames: 1, wins: 0, losses: 1, points: 3, currentStreak: 0, totalPlayTimeSec: 42 });
    expect((await GameModel.findById(id).lean())!.finalizedAt).toBeTruthy();
    expect(await LeaderboardEntryModel.countDocuments({ period: 'daily' })).toBe(2);
    expect((await GameModel.findById(id).lean())!.players.map((p) => [p.outcome, p.pointsAwarded])).toEqual(expect.arrayContaining([['WIN', 25], ['LOSS', 3]]));
  });

  it('records draws, and ignores cancelled / unfinished games', async () => {
    const { a, id } = await finishedGame(null);
    await finalizeGame(id);
    expect((await UserModel.findById(a._id).lean())!.stats).toMatchObject({ totalGames: 1, draws: 1, points: 10 });

    const u = await mkUser('cancel_a');
    const live = await createGameDoc({ type: 'ONLINE_RANDOM', config: { size: 3, winLength: 3 }, humans: [{ userId: u._id, mark: 'X' }, { userId: oid(), mark: 'O' }], status: 'IN_PROGRESS' });
    expect(await finalizeGame(String(live._id))).toEqual({ applied: false });
    await GameModel.updateOne({ _id: live._id }, { $set: { status: 'CANCELLED' } });
    expect(await finalizeGame(String(live._id))).toEqual({ applied: false });
    expect((await UserModel.findById(u._id).lean())!.stats!.totalGames).toBe(0);
    expect((await GameModel.findById(live._id).lean())!.finalizedAt).toBeNull();
  });

  it('level and XP follow the points awarded', async () => {
    const u = await mkUser('lvl_a');
    const o = await mkUser('lvl_b');
    for (let i = 0; i < 3; i++) {
      const g = await createGameDoc({ type: 'ONLINE_RANDOM', config: { size: 5, winLength: 4 }, humans: [{ userId: u._id, mark: 'X' }, { userId: o._id, mark: 'O' }], status: 'IN_PROGRESS' });
      await GameModel.updateOne({ _id: g._id }, { $set: { status: 'COMPLETED', moveCount: 9, durationMs: 1000, 'result.winner': 'X', 'result.winnerId': u._id, 'result.reason': 'LINE' } });
      await finalizeGame(String(g._id));
    }
    const s = (await UserModel.findById(u._id).lean())!.stats!;
    expect(s.points).toBe(150); // 25 * 2 (5x5 multiplier) * 3 wins
    expect(s.level).toBeGreaterThanOrEqual(2);
    expect(s.level).toBe(1 + Math.floor(Math.sqrt(s.xp / 50)));
    expect(s.bestStreak).toBe(3);
  });
});
