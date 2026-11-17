import { logger } from '../config/logger.js';
import { DAILY_REWARD_COINS } from '../constants/index.js';
import { RewardClaimModel, UserModel } from '../models/index.js';
import { Errors } from '../utils/errors.js';
import { audit } from './audit.service.js';

/**
 * Daily reward cycle. Everything here is server-authoritative: the client only asks "what is my status" and "claim";
 * the amount, the cycle day and the eligibility are computed from stored state and the server clock.
 *
 *  - "today" is the calendar day in the user's stored IANA timezone (changes are rate limited in user.service)
 *  - claiming on consecutive local days advances the 7-day cycle (day 7 -> back to day 1)
 *  - skipping a local day resets the streak to day 1
 *  - one claim per local day: guarded atomic update + unique (userId, dayKey) index on the claim history
 */
export const localDayKey = (d: Date, tz: string): string => {
  const fmt = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  try {
    return fmt(tz);
  } catch {
    return fmt('UTC');
  }
};

export const shiftDayKey = (key: string, days: number): string => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** First instant whose local date (in tz) is `targetKey`, found by bisection (handles DST / odd offsets). */
export function startOfLocalDay(targetKey: string, tz: string, around: Date): Date {
  let lo = around.getTime();
  let hi = lo + 50 * 3600_000;
  for (let i = 0; i < 40 && hi - lo > 1000; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDayKey(new Date(mid), tz) >= targetKey) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}

export interface DailyRewardView {
  day: number;
  coins: number;
  status: 'claimed' | 'claimable' | 'locked';
}

export async function getDailyStatus(userId: string, now = new Date()) {
  const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } }).lean();
  if (!user) throw Errors.notFound('User not found');
  const tz = user.timezone ?? 'UTC';
  const today = localDayKey(now, tz);
  const last = user.daily ?? {};
  const claimedToday = last.lastKey === today;
  const continuing = last.lastKey === shiftDayKey(today, -1);

  // Streak continues (claimed today or yesterday) -> next cycle day; otherwise start over at day 1.
  const nextDay = claimedToday || continuing ? ((last.day ?? 0) % 7) + 1 : 1;

  const cycle: DailyRewardView[] = DAILY_REWARD_COINS.map((coins, i) => {
    const day = i + 1;
    let status: DailyRewardView['status'] = 'locked';
    if (claimedToday) status = day <= (last.day ?? 0) ? 'claimed' : 'locked';
    else if (day < nextDay) status = 'claimed'; // continuing streak: earlier days of this cycle were claimed
    else if (day === nextDay) status = 'claimable';
    return { day, coins, status };
  });

  return {
    timezone: tz,
    today,
    canClaim: !claimedToday,
    claimedToday,
    nextDay,
    streak: claimedToday || continuing ? (last.day ?? 0) : 0,
    nextClaimAt: claimedToday ? startOfLocalDay(shiftDayKey(today, 1), tz, now).toISOString() : null,
    coins: user.wallet?.coins ?? 0,
    cycle,
  };
}

export async function claimDaily(userId: string, now = new Date()) {
  const status = await getDailyStatus(userId, now);
  if (!status.canClaim) {
    throw Errors.conflict('Todays reward was already claimed', 'REWARD_ALREADY_CLAIMED', { nextClaimAt: status.nextClaimAt });
  }
  const day = status.nextDay;
  const coins = DAILY_REWARD_COINS[day - 1]!;
  const user = await UserModel.findOne({ _id: userId }).select('daily').lean();
  const prev = user?.daily?.lastKey;

  // Compare-and-set on the previous claim key: of two concurrent claims exactly one matches.
  const updated = await UserModel.findOneAndUpdate(
    { _id: userId, deletedAt: { $exists: false }, ...(prev ? { 'daily.lastKey': prev } : { 'daily.lastKey': { $exists: false } }) },
    { $set: { 'daily.lastKey': status.today, 'daily.day': day, 'daily.lastClaimAt': now }, $inc: { 'wallet.coins': coins } },
    { new: true },
  ).lean();
  if (!updated) throw Errors.conflict('Todays reward was already claimed', 'REWARD_ALREADY_CLAIMED');

  try {
    await RewardClaimModel.create({ userId, dayKey: status.today, cycleDay: day, coins, timezone: status.timezone, claimedAt: now });
  } catch (err) {
    // The wallet was already credited atomically; history is secondary, never fail the claim because of it.
    logger.error({ err: (err as Error).message, userId }, 'reward claim history insert failed');
  }
  audit('reward.daily_claimed', { userId, meta: { day, coins } });
  return { claimed: { day, coins }, wallet: { coins: updated.wallet?.coins ?? 0 }, status: await getDailyStatus(userId, now) };
}

export async function claimHistory(userId: string, limit = 30) {
  const rows = await RewardClaimModel.find({ userId }).sort({ claimedAt: -1 }).limit(limit).lean();
  return rows.map((r) => ({ id: String(r._id), dayKey: r.dayKey, cycleDay: r.cycleDay, coins: r.coins, claimedAt: r.claimedAt }));
}
