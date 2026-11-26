import { Types } from 'mongoose';
import { CoinLedgerModel, UserModel } from '../models/index.js';
import { Errors } from '../utils/errors.js';

type Reason = 'ENTRY' | 'ENTRY_REFUND' | 'PRIZE' | 'REFUND';
type MoveResult = 'OK' | 'DUPLICATE' | 'NO_FUNDS';

const isDuplicateKey = (err: unknown) => (err as { code?: number }).code === 11000;

/**
 * Moves coins for one player and records it in the ledger. `key` is unique, so the same movement can never apply twice.
 * A debit is refused (NO_FUNDS) when the wallet cannot cover it, so balances never go negative.
 */
async function move(userId: Types.ObjectId | string, delta: number, key: string, reason: Reason, refId: string): Promise<MoveResult> {
  const uid = new Types.ObjectId(String(userId));
  if (delta < 0) {
    const debit = await UserModel.updateOne({ _id: uid, 'wallet.coins': { $gte: -delta } }, { $inc: { 'wallet.coins': delta } });
    if (debit.modifiedCount === 0) return 'NO_FUNDS';
  } else {
    await UserModel.updateOne({ _id: uid }, { $inc: { 'wallet.coins': delta } });
  }
  try {
    await CoinLedgerModel.create({ key, userId: uid, amount: delta, reason, refId });
    return 'OK';
  } catch (err) {
    if (isDuplicateKey(err)) {
      // This movement was already applied by an earlier request: undo the balance change made just now.
      await UserModel.updateOne({ _id: uid }, { $inc: { 'wallet.coins': -delta } });
      return 'DUPLICATE';
    }
    throw err;
  }
}

/** Can this user cover an entry of `amount` coins? */
export async function canAfford(userId: Types.ObjectId | string, amount: number): Promise<boolean> {
  if (amount <= 0) return true;
  const u = await UserModel.findById(userId).select('wallet.coins').lean();
  return (u?.wallet?.coins ?? 0) >= amount;
}

/** Returns entries to players whose match never started (rolled back after a failed start). */
export async function refundEntry(userIds: Array<Types.ObjectId | string>, amount: number, refId: string): Promise<void> {
  if (amount <= 0) return;
  for (const uid of userIds) await move(uid, amount, `ENTRY_REFUND:${refId}:${String(uid)}`, 'ENTRY_REFUND', refId);
}

/**
 * Takes `amount` coins from every player before a paid match starts. All or nothing: if one player cannot pay, the coins
 * already taken from the others are returned and the request fails with INSUFFICIENT_COINS.
 */
export async function chargeEntry(userIds: Array<Types.ObjectId | string>, amount: number, refId: string): Promise<void> {
  if (amount <= 0) return;
  const taken: Types.ObjectId[] = [];
  for (const uid of userIds) {
    const result = await move(uid, -amount, `ENTRY:${refId}:${String(uid)}`, 'ENTRY', refId);
    if (result === 'NO_FUNDS') {
      await refundEntry(taken, amount, refId);
      throw Errors.conflict('Not enough coins to enter this match.', 'INSUFFICIENT_COINS');
    }
    if (result === 'OK') taken.push(new Types.ObjectId(String(uid)));
  }
}

interface SettleInput {
  _id: Types.ObjectId;
  entryAmount?: number | null;
  status: string;
  moveCount: number;
  players: Array<{ userId?: Types.ObjectId | null; isAI: boolean }>;
  result?: { winnerId?: Types.ObjectId | null; reason?: string | null } | null;
}

/**
 * Pays out a finished paid match. The winner takes the whole pot (both entries). A draw, or a match abandoned before both
 * players moved, returns each entry. Ledger keys make repeated calls safe.
 */
export async function settleMatch(game: SettleInput): Promise<void> {
  const entry = game.entryAmount ?? 0;
  if (entry <= 0 || (game.status !== 'COMPLETED' && game.status !== 'DRAW')) return;
  const refId = String(game._id);
  const humans = game.players.filter((p) => p.userId && !p.isAI).map((p) => p.userId as Types.ObjectId);
  const reason = game.result?.reason;
  const abandoned = (reason === 'FORFEIT' || reason === 'TIMEOUT' || reason === 'DISCONNECT') && game.moveCount < 2;
  const winnerId = game.result?.winnerId ? String(game.result.winnerId) : null;

  if (game.status === 'DRAW' || abandoned || !winnerId) {
    for (const uid of humans) await move(uid, entry, `REFUND:${refId}:${String(uid)}`, 'REFUND', refId);
    return;
  }
  await move(winnerId, entry * humans.length, `PRIZE:${refId}:${winnerId}`, 'PRIZE', refId);
}
