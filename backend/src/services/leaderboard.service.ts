import { Types } from 'mongoose';
import { FriendshipModel, LeaderboardEntryModel, UserModel } from '../models/index.js';
import { paged, skipOf } from '../utils/pagination.js';
import { dayKey, monthKey, weekKey } from '../utils/time.js';
import { CARD_FIELDS, toCard } from './presenter.js';

export type Metric = 'points' | 'wins';
export interface LbQuery {
  page: number;
  limit: number;
  metric: Metric;
}

const field = (m: Metric) => (m === 'wins' ? 'stats.wins' : 'stats.points');

function periodKeyFor(period: 'daily' | 'weekly' | 'monthly', now = new Date()): string {
  return period === 'daily' ? dayKey(now) : period === 'weekly' ? weekKey(now) : monthKey(now);
}

/** All-time board straight from users.stats (single source of truth, written only by the finalizer). */
export async function globalBoard(viewerId: string, q: LbQuery) {
  const filter = { deletedAt: { $exists: false }, 'stats.totalGames': { $gt: 0 } };
  const f = field(q.metric);
  const sort = { [f]: -1, _id: 1 } as const;
  const [rows, total] = await Promise.all([
    UserModel.find(filter).sort(sort).skip(skipOf(q)).limit(q.limit).select(`${CARD_FIELDS} stats.points stats.wins stats.totalGames`).lean(),
    UserModel.countDocuments(filter),
  ]);
  const items = rows.map((u, i) => ({
    rank: skipOf(q) + i + 1,
    user: toCard(u),
    points: u.stats?.points ?? 0,
    wins: u.stats?.wins ?? 0,
    games: u.stats?.totalGames ?? 0,
  }));
  return { ...paged(items, total, q), me: await myRank(viewerId, filter, q.metric) };
}

async function myRank(viewerId: string, baseFilter: Record<string, unknown>, metric: Metric) {
  const me = await UserModel.findById(viewerId).select('stats.points stats.wins stats.totalGames').lean();
  if (!me || !me.stats?.totalGames) return { rank: null, points: me?.stats?.points ?? 0, wins: me?.stats?.wins ?? 0 };
  const f = field(metric);
  const mine = metric === 'wins' ? (me.stats.wins ?? 0) : (me.stats.points ?? 0);
  const ahead = await UserModel.countDocuments({
    ...baseFilter,
    $or: [{ [f]: { $gt: mine } }, { [f]: mine, _id: { $lt: me._id } }],
  });
  return { rank: ahead + 1, points: me.stats.points ?? 0, wins: me.stats.wins ?? 0 };
}

export async function periodBoard(viewerId: string, period: 'daily' | 'weekly' | 'monthly', q: LbQuery) {
  const periodKey = periodKeyFor(period);
  const f = q.metric === 'wins' ? 'wins' : 'points';
  const filter = { period, periodKey };
  const [rows, total] = await Promise.all([
    LeaderboardEntryModel.find(filter).sort({ [f]: -1, _id: 1 }).skip(skipOf(q)).limit(q.limit).lean(),
    LeaderboardEntryModel.countDocuments(filter),
  ]);
  const users = await UserModel.find({ _id: { $in: rows.map((r) => r.userId) } }).select(CARD_FIELDS).lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const items = rows
    .filter((r) => byId.has(String(r.userId)))
    .map((r, i) => ({ rank: skipOf(q) + i + 1, user: toCard(byId.get(String(r.userId))!), points: r.points, wins: r.wins, games: r.games }));

  const mine = await LeaderboardEntryModel.findOne({ ...filter, userId: viewerId }).lean();
  let rank: number | null = null;
  if (mine) {
    const val = f === 'wins' ? mine.wins : mine.points;
    rank = 1 + (await LeaderboardEntryModel.countDocuments({ ...filter, $or: [{ [f]: { $gt: val } }, { [f]: val, _id: { $lt: mine._id } }] }));
  }
  return { ...paged(items, total, q), periodKey, me: { rank, points: mine?.points ?? 0, wins: mine?.wins ?? 0 } };
}

export async function friendsBoard(viewerId: string, q: LbQuery) {
  const me = new Types.ObjectId(viewerId);
  const rel = await FriendshipModel.find({ status: 'ACCEPTED', $or: [{ requesterId: me }, { recipientId: me }] }).select('requesterId recipientId').lean();
  const ids = [me, ...rel.map((r) => (String(r.requesterId) === viewerId ? r.recipientId : r.requesterId))];
  const filter = { _id: { $in: ids }, deletedAt: { $exists: false } };
  const f = field(q.metric);
  const [rows, total] = await Promise.all([
    UserModel.find(filter).sort({ [f]: -1, _id: 1 }).skip(skipOf(q)).limit(q.limit).select(`${CARD_FIELDS} stats.points stats.wins stats.totalGames`).lean(),
    UserModel.countDocuments(filter),
  ]);
  const items = rows.map((u, i) => ({
    rank: skipOf(q) + i + 1,
    user: toCard(u),
    points: u.stats?.points ?? 0,
    wins: u.stats?.wins ?? 0,
    games: u.stats?.totalGames ?? 0,
    isMe: String(u._id) === viewerId,
  }));
  return paged(items, total, q);
}
