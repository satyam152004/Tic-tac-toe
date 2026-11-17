import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { OTP } from '../constants/index.js';
import { UserModel } from '../models/index.js';
import { Errors } from '../utils/errors.js';
import { addMs } from '../utils/time.js';

/**
 * Six-digit email one-time codes.
 *  - generated with a CSPRNG (crypto.randomInt), never derived from anything guessable
 *  - stored only as HMAC-SHA256(secret, purpose:userId:code); a leaked database cannot be reversed into codes
 *  - expire after 10 minutes, allow 5 wrong attempts (then the code is destroyed), single use
 *  - resend cooldown (60 s) and an hourly send cap (5)
 *  - the plain code only ever exists in the email body: it is not returned by any API and not logged
 */
export type OtpPurpose = 'verify' | 'reset';
const FIELD = { verify: 'emailOtp', reset: 'resetOtp' } as const;

const digest = (purpose: OtpPurpose, userId: string, code: string): string =>
  createHmac('sha256', env.JWT_ACCESS_SECRET).update(`otp:${purpose}:${userId}:${code}`).digest('hex');

const safeEqualHex = (a: string, b: string): boolean => {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
};

export const generateCode = (): string => String(randomInt(0, 10 ** OTP.LENGTH)).padStart(OTP.LENGTH, '0');

interface OtpState {
  hash?: string;
  expiresAt?: Date;
  attempts?: number;
  sentAt?: Date;
  windowStart?: Date;
  windowCount?: number;
}

/**
 * Issues a fresh code for the user and returns it so the caller can e-mail it. Enforces cooldown + hourly cap and
 * invalidates any previous code. Throws OTP_COOLDOWN / OTP_RATE_LIMITED (429) when sending too often.
 */
export async function issueOtp(userId: string, purpose: OtpPurpose, now = new Date()): Promise<string> {
  const field = FIELD[purpose];
  const user = await UserModel.findById(userId).select(`+${field}`).lean();
  if (!user) throw Errors.notFound('User not found');
  const st: OtpState = (user as unknown as Record<string, OtpState | undefined>)[field] ?? {};

  if (st.sentAt && now.getTime() - st.sentAt.getTime() < OTP.RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((OTP.RESEND_COOLDOWN_MS - (now.getTime() - st.sentAt.getTime())) / 1000);
    throw Object.assign(Errors.tooMany(`Please wait ${wait}s before requesting another code`, 'OTP_COOLDOWN'), { details: { retryAfterSec: wait } });
  }
  const windowFresh = st.windowStart && now.getTime() - st.windowStart.getTime() < 3600_000;
  const count = windowFresh ? (st.windowCount ?? 0) : 0;
  if (count >= OTP.MAX_SENDS_PER_HOUR) throw Errors.tooMany('Too many codes requested, try again later', 'OTP_RATE_LIMITED');

  const code = generateCode();
  // Optimistic guard on sentAt: two concurrent resends cannot both pass the cooldown.
  const guard = st.sentAt ? { [`${field}.sentAt`]: st.sentAt } : { [`${field}.sentAt`]: { $exists: false } };
  const res = await UserModel.updateOne(
    { _id: userId, ...guard },
    {
      $set: {
        [field]: {
          hash: digest(purpose, userId, code),
          expiresAt: addMs(now, OTP.TTL_MS),
          attempts: 0,
          sentAt: now,
          windowStart: windowFresh ? st.windowStart : now,
          windowCount: count + 1,
        },
      },
    },
  );
  if (res.modifiedCount !== 1) throw Errors.tooMany('A code was just sent, please wait', 'OTP_COOLDOWN');
  return code;
}

/**
 * Verifies and consumes a code. Always answers with the same INVALID_OTP error for unknown user / wrong / expired code so the
 * endpoint cannot be used to enumerate accounts. OTP_LOCKED is returned after too many wrong attempts.
 */
export async function consumeOtp(userId: string | null, purpose: OtpPurpose, code: string): Promise<void> {
  const field = FIELD[purpose];
  const invalid = () => Errors.badRequest('The code is invalid or has expired', 'INVALID_OTP');
  if (!userId) {
    digest(purpose, 'none', code); // keep timing similar
    throw invalid();
  }
  const user = await UserModel.findById(userId).select(`+${field}`).lean();
  const st = user ? ((user as unknown as Record<string, OtpState | undefined>)[field] ?? null) : null;
  if (!st?.hash || !st.expiresAt || st.expiresAt.getTime() < Date.now()) throw invalid();
  if ((st.attempts ?? 0) >= OTP.MAX_ATTEMPTS) {
    await UserModel.updateOne({ _id: userId }, { $unset: { [`${field}.hash`]: 1, [`${field}.expiresAt`]: 1 } });
    throw Errors.tooMany('Too many wrong attempts. Request a new code.', 'OTP_LOCKED');
  }

  if (!safeEqualHex(st.hash, digest(purpose, userId, code))) {
    const upd = await UserModel.findOneAndUpdate({ _id: userId, [`${field}.hash`]: st.hash }, { $inc: { [`${field}.attempts`]: 1 } }, { new: true }).select(`+${field}`).lean();
    const attempts = ((upd as unknown as Record<string, OtpState | undefined> | null)?.[field]?.attempts) ?? OTP.MAX_ATTEMPTS;
    if (attempts >= OTP.MAX_ATTEMPTS) {
      await UserModel.updateOne({ _id: userId }, { $unset: { [`${field}.hash`]: 1, [`${field}.expiresAt`]: 1 } });
      throw Errors.tooMany('Too many wrong attempts. Request a new code.', 'OTP_LOCKED');
    }
    throw Object.assign(invalid(), { details: { attemptsLeft: OTP.MAX_ATTEMPTS - attempts } });
  }
  // Single use: only one concurrent request can consume the matching hash.
  const used = await UserModel.updateOne({ _id: userId, [`${field}.hash`]: st.hash }, { $unset: { [`${field}.hash`]: 1, [`${field}.expiresAt`]: 1 }, $set: { [`${field}.attempts`]: 0 } });
  if (used.modifiedCount !== 1) throw invalid();
}
