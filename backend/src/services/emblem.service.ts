import { UserEmblemsModel } from '../models/Emblem.js';
import { UserModel } from '../models/index.js';
import { Errors } from '../utils/errors.js';
import { audit } from './audit.service.js';

/** Server-side emblem catalog. Prices live here only: the client never decides what something costs. */
export const EMBLEM_CATALOG = [
  { id: 'cobalt', name: 'Cobalt Emblem', sub: 'Day 7 Grand Chest', cost: 0, badge: '◈', bg: '#EFF4FF', fg: '#1D4ED8' },
  { id: 'tactical', name: 'Tactical Grid', sub: 'Season 4 Starter', cost: 0, badge: '⊞', bg: '#F0FDF4', fg: '#15803D' },
  { id: 'crown', name: 'Gold II Crown', sub: 'Profile Crest', cost: 450, badge: '♛', bg: '#FFFBEB', fg: '#B45309' },
  { id: 'frame', name: 'Obsidian Frame', sub: 'Avatar Border', cost: 800, badge: '❖', bg: '#141518', fg: '#FFFFFF' },
] as const;
export const EMBLEM_IDS = EMBLEM_CATALOG.map((e) => e.id) as [string, ...string[]];
const DEFAULT_EQUIPPED = 'cobalt';

const find = (id: string) => EMBLEM_CATALOG.find((e) => e.id === id);

async function view(userId: string) {
  const [user, doc] = await Promise.all([
    UserModel.findOne({ _id: userId, deletedAt: { $exists: false } }).select('wallet').lean(),
    UserEmblemsModel.findOne({ userId }).lean(),
  ]);
  if (!user) throw Errors.notFound('Player not found');
  const owned = new Set(doc?.unlocked ?? []);
  const equipped = doc?.equipped ?? DEFAULT_EQUIPPED;
  return {
    coins: user.wallet?.coins ?? 0,
    equipped,
    emblems: EMBLEM_CATALOG.map((e) => ({ ...e, unlocked: e.cost === 0 || owned.has(e.id), equipped: e.id === equipped })),
  };
}

export const listEmblems = (userId: string) => view(userId);

const isUnlocked = async (userId: string, id: string) => {
  const e = find(id)!;
  if (e.cost === 0) return true;
  return !!(await UserEmblemsModel.exists({ userId, unlocked: id }));
};

/** Buys (spends coins atomically) and equips an emblem. Free emblems are simply equipped. */
export async function unlockEmblem(userId: string, id: string) {
  const e = find(id);
  if (!e) throw Errors.notFound('We can\'t find that emblem.', 'EMBLEM_NOT_FOUND');
  if (await isUnlocked(userId, id)) throw Errors.conflict('You already own this emblem', 'EMBLEM_ALREADY_OWNED');

  // Spend first: the guarded update only matches when the balance covers the price, so it can never go negative.
  const paid = await UserModel.findOneAndUpdate(
    { _id: userId, deletedAt: { $exists: false }, 'wallet.coins': { $gte: e.cost } },
    { $inc: { 'wallet.coins': -e.cost } },
    { new: true },
  ).lean();
  if (!paid) throw Errors.conflict('Not enough coins', 'INSUFFICIENT_COINS');

  try {
    // Matches only while the emblem is not yet owned; a concurrent purchase hits the unique userId index instead.
    await UserEmblemsModel.updateOne({ userId, unlocked: { $ne: id } }, { $addToSet: { unlocked: id }, $set: { equipped: id } }, { upsert: true });
  } catch (err) {
    await UserModel.updateOne({ _id: userId }, { $inc: { 'wallet.coins': e.cost } }); // refund
    if ((err as { code?: number }).code === 11000) throw Errors.conflict('You already own this emblem', 'EMBLEM_ALREADY_OWNED');
    throw err;
  }
  audit('shop.emblem_unlocked', { userId, meta: { id, cost: e.cost } });
  return view(userId);
}

export async function equipEmblem(userId: string, id: string) {
  if (!find(id)) throw Errors.notFound('We can\'t find that emblem.', 'EMBLEM_NOT_FOUND');
  if (!(await isUnlocked(userId, id))) throw Errors.conflict('Unlock this emblem first', 'EMBLEM_LOCKED');
  await UserEmblemsModel.updateOne({ userId }, { $set: { equipped: id } }, { upsert: true });
  return view(userId);
}
