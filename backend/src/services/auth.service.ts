import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { OTP } from '../constants/index.js';
import { RefreshTokenModel, UserDoc, UserModel } from '../models/index.js';
import { Errors } from '../utils/errors.js';
import { randomToken, sha256, uuid } from '../utils/crypto.js';
import { signAccessToken } from '../utils/tokens.js';
import { addMs, DAY_MS } from '../utils/time.js';
import { audit } from './audit.service.js';
import { mailTemplates, sendMail } from './mail.service.js';
import { notify } from './notification.service.js';
import { consumeOtp, issueOtp } from './otp.service.js';
import { toSelf } from './presenter.js';
import { socialVerifiers, SocialIdentity } from './social.service.js';

export interface SessionContext {
  ip?: string;
  userAgent?: string;
  deviceName?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access token lifetime in seconds. */
  expiresIn: number;
  refreshExpiresAt: string;
}

// A real bcrypt hash of a random string: compared against when the user does not exist so that
// "unknown email" and "wrong password" take the same time (prevents account enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync(randomBytes(16).toString('hex'), env.BCRYPT_ROUNDS);

const hashPassword = (pw: string) => bcrypt.hash(pw, env.BCRYPT_ROUNDS);

// ---------------------------------------------------------------- sessions

async function issueSession(user: UserDoc, ctx: SessionContext, familyId: string = uuid()): Promise<TokenPair> {
  const ttlDays = user.accountType === 'GUEST' ? env.GUEST_REFRESH_TOKEN_TTL_DAYS : env.REFRESH_TOKEN_TTL_DAYS;
  const refreshToken = randomToken(48);
  const expiresAt = addMs(new Date(), ttlDays * DAY_MS);
  await RefreshTokenModel.create({
    userId: user._id,
    familyId,
    tokenHash: sha256(refreshToken),
    expiresAt,
    ip: ctx.ip,
    userAgent: ctx.userAgent?.slice(0, 300),
    deviceName: ctx.deviceName,
  });
  const accessToken = signAccessToken({ sub: String(user._id), sid: familyId, act: user.accountType === 'REGISTERED' ? 'REGISTERED' : 'GUEST' });
  return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: env.ACCESS_TOKEN_TTL_SEC, refreshExpiresAt: expiresAt.toISOString() };
}

async function revokeFamily(familyId: string): Promise<void> {
  await RefreshTokenModel.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: unknown): Promise<void> {
  await RefreshTokenModel.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

/** True when the account can log in with email + password (the hash is never selected by default). */
export async function hasPassword(userId: unknown): Promise<boolean> {
  return !!(await UserModel.exists({ _id: userId, passwordHash: { $exists: true, $nin: [null, ''] } }));
}

async function authResult(user: UserDoc, ctx: SessionContext) {
  const tokens = await issueSession(user, ctx);
  return { user: toSelf(user.toObject(), await hasPassword(user._id)), tokens };
}

// ---------------------------------------------------------------- creation helpers

async function createUserWithUniqueUsername(base: string, fields: Record<string, unknown>): Promise<UserDoc> {
  const clean = base.replace(/[^A-Za-z0-9_]/g, '').slice(0, 14) || 'player';
  for (let attempt = 0; attempt < 6; attempt++) {
    const suffix = attempt === 0 ? '' : String(Math.floor(Math.random() * 9000 + 1000));
    const username = (clean + suffix).slice(0, 20).padEnd(3, '0');
    try {
      return await UserModel.create({ username, usernameLower: username.toLowerCase(), ...fields });
    } catch (err) {
      const e = err as { code?: number; keyPattern?: Record<string, unknown> };
      if (e.code === 11000 && e.keyPattern?.usernameLower) continue;
      throw err;
    }
  }
  throw Errors.conflict('Couldn\'t make a username. Try again.', 'USERNAME_TAKEN');
}

async function sendVerification(user: UserDoc): Promise<void> {
  if (!user.email) return;
  const token = randomToken(32);
  await UserModel.updateOne(
    { _id: user._id },
    { $set: { emailVerifyTokenHash: sha256(token), emailVerifyExpiresAt: addMs(new Date(), DAY_MS) } },
  );
  const code = await issueOtp(String(user._id), 'verify').catch(() => null); // cooldown must never break registration
  // The account already exists at this point. A mail outage must not turn a created account into a failed request
  // (the client would retry and hit EMAIL_TAKEN); the user can request a new code via resendVerification.
  if (code) await sendMailBestEffort(mailTemplates.verifyEmail(user.email, token, code), 'verify');
}

/** Sends an email whose failure must not fail the surrounding operation. Delivery errors are logged, never thrown. */
async function sendMailBestEffort(mail: Parameters<typeof sendMail>[0], purpose: string): Promise<boolean> {
  try {
    await sendMail(mail);
    return true;
  } catch (err) {
    logger.warn({ purpose, err: (err as Error).message }, 'Email delivery failed (operation continued)');
    return false;
  }
}

/** Re-sends the six-digit verification code (cooldown + hourly cap enforced by issueOtp). */
export async function resendVerification(userId: string): Promise<{ sent: true; retryAfterSec: number }> {
  const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } });
  if (!user?.email) throw Errors.badRequest('This account has no email.', 'NO_EMAIL');
  if (user.emailVerified) throw Errors.conflict('Your email is already verified.', 'ALREADY_VERIFIED');
  const code = await issueOtp(String(user._id), 'verify');
  await sendMail(mailTemplates.resendVerifyEmail(user.email, code));
  audit('auth.verification_resent', { userId: user._id });
  return { sent: true, retryAfterSec: OTP.RESEND_COOLDOWN_MS / 1000 };
}

// ---------------------------------------------------------------- set a password (Google/Apple accounts)

/** Emails a 6-digit code to the account's own address: proof of ownership before a password is added. */
export async function requestSetPassword(userId: string): Promise<{ sent: true; retryAfterSec: number }> {
  const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } });
  if (!user) throw Errors.notFound('Player not found');
  if (user.accountType !== 'REGISTERED') throw Errors.badRequest('Create an account first', 'NOT_REGISTERED');
  if (!user.email) throw Errors.badRequest('This account has no email.', 'NO_EMAIL');
  if (await hasPassword(user._id)) throw Errors.conflict('This account already has a password', 'PASSWORD_ALREADY_SET');
  const code = await issueOtp(String(user._id), 'reset');
  await sendMail(mailTemplates.setPassword(user.email, code));
  audit('auth.set_password_requested', { userId: user._id });
  return { sent: true, retryAfterSec: OTP.RESEND_COOLDOWN_MS / 1000 };
}

/**
 * Adds a password to an account that has none (the Google/Apple link is kept, so both methods work afterwards).
 * Every session is revoked and a fresh one is returned for the calling device.
 */
export async function setPassword(userId: string, input: { code: string; newPassword: string }, ctx: SessionContext) {
  const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } });
  if (!user) throw Errors.notFound('Player not found');
  if (user.accountType !== 'REGISTERED' || !user.email) throw Errors.badRequest('Create an account first', 'NOT_REGISTERED');
  if (await hasPassword(user._id)) throw Errors.conflict('This account already has a password', 'PASSWORD_ALREADY_SET');
  await consumeOtp(String(user._id), 'reset', input.code);
  user.passwordHash = await hashPassword(input.newPassword);
  if (!user.providers.some((p) => p.provider === 'password')) user.providers.push({ provider: 'password', subject: user.email });
  await user.save();
  await revokeAllSessions(user._id);
  audit('auth.password_set', { userId: user._id, ip: ctx.ip });
  await sendMailBestEffort(mailTemplates.passwordChanged(user.email), 'password-set');
  void notify(user._id, { type: 'ACCOUNT', title: 'Password added', body: 'You can now sign in with your email and password too.' });
  return authResult(user, ctx);
}

// ---------------------------------------------------------------- public API

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
  displayName?: string;
}

export async function register(input: RegisterInput, ctx: SessionContext) {
  const email = input.email.toLowerCase();
  if (await UserModel.exists({ email })) throw Errors.conflict('That email is already in use.', 'EMAIL_TAKEN');
  if (await UserModel.exists({ usernameLower: input.username.toLowerCase() })) throw Errors.conflict('Username is already taken', 'USERNAME_TAKEN');
  let user: UserDoc;
  try {
    user = await UserModel.create({
      username: input.username,
      usernameLower: input.username.toLowerCase(),
      displayName: input.displayName ?? input.username,
      email,
      passwordHash: await hashPassword(input.password),
      accountType: 'REGISTERED',
      providers: [{ provider: 'password', subject: email }],
    });
  } catch (err) {
    const e = err as { code?: number; keyPattern?: Record<string, unknown> };
    if (e.code === 11000) {
      if (e.keyPattern?.email) throw Errors.conflict('That email is already in use.', 'EMAIL_TAKEN');
      throw Errors.conflict('Username is already taken', 'USERNAME_TAKEN');
    }
    throw err;
  }
  await sendVerification(user);
  audit('auth.register', { userId: user._id, ip: ctx.ip });
  return authResult(user, ctx);
}

export async function login(input: { email: string; password: string }, ctx: SessionContext) {
  const user = await UserModel.findOne({ email: input.email.toLowerCase(), deletedAt: { $exists: false } }).select('+passwordHash');
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) {
    audit('auth.login_failed', { ip: ctx.ip, userId: user?._id });
    throw Errors.unauthorized('Wrong email or password.', 'INVALID_CREDENTIALS');
  }
  UserModel.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } }).catch(() => undefined);
  audit('auth.login', { userId: user._id, ip: ctx.ip });
  return authResult(user, ctx);
}

export async function guestLogin(input: { displayName?: string }, ctx: SessionContext) {
  const suffix = randomToken(6).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toLowerCase();
  const user = await createUserWithUniqueUsername(`guest_${suffix}`, {
    displayName: input.displayName ?? `Guest ${suffix.slice(0, 4).toUpperCase()}`,
    accountType: 'GUEST',
    providers: [{ provider: 'guest', subject: uuid() }],
  });
  audit('auth.guest', { userId: user._id, ip: ctx.ip });
  return authResult(user, ctx);
}

/** Guest -> registered. Keeps all progress/stats because the same user document is upgraded. */
export async function upgradeGuest(
  userId: string,
  input: { email: string; password: string; username?: string; displayName?: string },
  ctx: SessionContext,
) {
  const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } });
  if (!user) throw Errors.notFound('Player not found');
  if (user.accountType !== 'GUEST') throw Errors.conflict('You already have an account.', 'ALREADY_REGISTERED');
  const email = input.email.toLowerCase();
  if (await UserModel.exists({ email })) throw Errors.conflict('That email is already in use.', 'EMAIL_TAKEN');
  if (input.username) {
    const lower = input.username.toLowerCase();
    if (await UserModel.exists({ usernameLower: lower, _id: { $ne: user._id } })) throw Errors.conflict('Username is already taken', 'USERNAME_TAKEN');
    user.username = input.username;
    user.usernameLower = lower;
  }
  if (input.displayName) user.displayName = input.displayName;
  user.email = email;
  user.emailVerified = false;
  user.passwordHash = await hashPassword(input.password);
  user.accountType = 'REGISTERED';
  user.providers.push({ provider: 'password', subject: email });
  try {
    await user.save();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw Errors.conflict('That email or username is already in use.', 'CONFLICT');
    throw err;
  }
  // The access token embeds the account type => replace every session with fresh ones.
  await revokeAllSessions(user._id);
  await sendVerification(user);
  audit('auth.guest_upgraded', { userId: user._id, ip: ctx.ip });
  return authResult(user, ctx);
}

/**
 * Turns the signed-in GUEST into a registered account through Google/Apple, keeping coins, stats and history.
 * Never merges two existing accounts: an identity or email that already belongs to someone else is refused.
 */
export async function upgradeGuestWithSocial(userId: string, provider: 'google' | 'apple', token: string, ctx: SessionContext, extra: { displayName?: string } = {}) {
  const identity: SocialIdentity = await (provider === 'google' ? socialVerifiers.google(token) : socialVerifiers.apple(token));
  const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } });
  if (!user) throw Errors.notFound('Player not found');
  if (user.accountType !== 'GUEST') throw Errors.conflict('You already have an account.', 'ALREADY_REGISTERED');
  if (!identity.email || !identity.emailVerified) throw Errors.badRequest('Google or Apple did not share a verified email.', 'SOCIAL_EMAIL_REQUIRED');
  const email = identity.email.toLowerCase();
  if (await UserModel.exists({ providers: { $elemMatch: { provider, subject: identity.subject } } })) {
    throw Errors.conflict('That account already has a profile. Sign in with it instead.', 'SOCIAL_ALREADY_LINKED');
  }
  if (await UserModel.exists({ email, _id: { $ne: user._id } })) throw Errors.conflict('That email is already in use.', 'EMAIL_TAKEN');
  user.email = email;
  user.emailVerified = true;
  user.accountType = 'REGISTERED';
  user.providers.push({ provider, subject: identity.subject });
  if (extra.displayName) user.displayName = extra.displayName;
  try {
    await user.save();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw Errors.conflict('That email is already in use.', 'EMAIL_TAKEN');
    throw err;
  }
  // The access token embeds the account type => replace every session with fresh ones.
  await revokeAllSessions(user._id);
  audit('auth.guest_upgraded_social', { userId: user._id, ip: ctx.ip, meta: { provider } });
  return authResult(user, ctx);
}

export async function socialLogin(provider: 'google' | 'apple', token: string, ctx: SessionContext, extra: { displayName?: string } = {}) {
  const identity: SocialIdentity = await (provider === 'google' ? socialVerifiers.google(token) : socialVerifiers.apple(token));
  let user = await UserModel.findOne({ providers: { $elemMatch: { provider, subject: identity.subject } }, deletedAt: { $exists: false } });
  if (!user && identity.email && identity.emailVerified) {
    // Link to an existing account with the same *verified* email.
    user = await UserModel.findOne({ email: identity.email.toLowerCase(), deletedAt: { $exists: false } });
    if (user) {
      // Pre-hijacking defence: if the local account's email was never verified, whoever registered it may not be the
      // real owner (and knows its password). The provider just proved ownership, so drop the password and all sessions.
      const wasUnverified = !user.emailVerified;
      user.providers.push({ provider, subject: identity.subject });
      user.emailVerified = true;
      await user.save();
      if (wasUnverified) {
        await UserModel.updateOne({ _id: user._id }, { $unset: { passwordHash: 1, emailVerifyTokenHash: 1, emailVerifyExpiresAt: 1 } });
        await revokeAllSessions(user._id);
        audit('auth.social_link_unverified_reset', { userId: user._id, ip: ctx.ip });
      }
    }
  }
  if (!user) {
    const base = (identity.email?.split('@')[0] ?? identity.name ?? 'player').replace(/[^A-Za-z0-9_]/g, '');
    user = await createUserWithUniqueUsername(base || 'player', {
      displayName: (extra.displayName ?? identity.name ?? base ?? 'Player').slice(0, 40) || 'Player',
      email: identity.email && identity.emailVerified ? identity.email.toLowerCase() : undefined,
      emailVerified: identity.emailVerified,
      accountType: 'REGISTERED',
      providers: [{ provider, subject: identity.subject }],
    });
  }
  audit(`auth.${provider}_login`, { userId: user._id, ip: ctx.ip });
  return authResult(user, ctx);
}

/** Refresh token rotation with reuse detection. */
export async function refresh(refreshToken: string, ctx: SessionContext) {
  const hash = sha256(refreshToken);
  const existing = await RefreshTokenModel.findOne({ tokenHash: hash });
  if (!existing) throw Errors.unauthorized('Please sign in again.', 'INVALID_REFRESH_TOKEN');

  if (existing.revokedAt) {
    // A rotated/revoked token is being replayed: treat as theft and kill the whole session family.
    if (existing.replacedByHash) {
      await revokeFamily(existing.familyId);
      audit('auth.refresh_reuse_detected', { userId: existing.userId, ip: ctx.ip, meta: { familyId: existing.familyId } });
      throw Errors.unauthorized('For your safety, please sign in again.', 'REFRESH_TOKEN_REUSED');
    }
    throw Errors.unauthorized('Please sign in again.', 'INVALID_REFRESH_TOKEN');
  }
  if (existing.expiresAt.getTime() <= Date.now()) throw Errors.unauthorized('Your sign-in has expired. Please sign in again.', 'REFRESH_TOKEN_EXPIRED');

  const user = await UserModel.findOne({ _id: existing.userId, deletedAt: { $exists: false } });
  if (!user) throw Errors.unauthorized('Account no longer exists', 'INVALID_REFRESH_TOKEN');

  const ttlDays = user.accountType === 'GUEST' ? env.GUEST_REFRESH_TOKEN_TTL_DAYS : env.REFRESH_TOKEN_TTL_DAYS;
  const newToken = randomToken(48);
  const newHash = sha256(newToken);
  // Atomic claim: only ONE concurrent request can rotate a given token.
  const claimed = await RefreshTokenModel.findOneAndUpdate(
    { _id: existing._id, revokedAt: null },
    { $set: { revokedAt: new Date(), replacedByHash: newHash } },
  );
  if (!claimed) {
    await revokeFamily(existing.familyId);
    throw Errors.unauthorized('For your safety, please sign in again.', 'REFRESH_TOKEN_REUSED');
  }
  const expiresAt = addMs(new Date(), ttlDays * DAY_MS);
  await RefreshTokenModel.create({
    userId: user._id,
    familyId: existing.familyId,
    tokenHash: newHash,
    expiresAt,
    ip: ctx.ip,
    userAgent: ctx.userAgent?.slice(0, 300),
    deviceName: existing.deviceName,
  });
  return {
    accessToken: signAccessToken({ sub: String(user._id), sid: existing.familyId, act: user.accountType === 'REGISTERED' ? 'REGISTERED' : 'GUEST' }),
    refreshToken: newToken,
    tokenType: 'Bearer' as const,
    expiresIn: env.ACCESS_TOKEN_TTL_SEC,
    refreshExpiresAt: expiresAt.toISOString(),
  };
}

/** Logout this device: revoke the session family of the given refresh token (idempotent). */
export async function logout(refreshToken: string): Promise<void> {
  const t = await RefreshTokenModel.findOne({ tokenHash: sha256(refreshToken) });
  if (t) {
    await revokeFamily(t.familyId);
    audit('auth.logout', { userId: t.userId });
  }
}

export async function logoutAll(userId: string, ip?: string): Promise<void> {
  await revokeAllSessions(userId);
  audit('auth.logout_all', { userId, ip });
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await UserModel.findOne({ email: email.toLowerCase(), deletedAt: { $exists: false } });
  if (!user || user.accountType !== 'REGISTERED') return; // always behave identically (no enumeration)
  const token = randomToken(32);
  await UserModel.updateOne(
    { _id: user._id },
    { $set: { passwordResetTokenHash: sha256(token), passwordResetExpiresAt: addMs(new Date(), 3600_000) } },
  );
  const code = await issueOtp(String(user._id), 'reset').catch(() => null); // silently skipped while cooling down: no enumeration
  // A delivery failure must look exactly like success: otherwise the response reveals which emails have accounts.
  if (code) await sendMailBestEffort(mailTemplates.resetPassword(user.email!, token, code), 'reset');
  audit('auth.forgot_password', { userId: user._id });
}

export type ResetInput = { token: string; newPassword: string } | { email: string; code: string; newPassword: string };

export async function resetPassword(input: ResetInput): Promise<void> {
  let user;
  if ('token' in input) {
    user = await UserModel.findOne({
      passwordResetTokenHash: sha256(input.token),
      passwordResetExpiresAt: { $gt: new Date() },
      deletedAt: { $exists: false },
    }).select('+passwordResetTokenHash +passwordResetExpiresAt');
    if (!user) throw Errors.badRequest('This link has expired. Ask for a new one.', 'INVALID_RESET_TOKEN');
  } else {
    const found = await UserModel.findOne({ email: input.email.toLowerCase(), accountType: 'REGISTERED', deletedAt: { $exists: false } });
    await consumeOtp(found ? String(found._id) : null, 'reset', input.code); // same INVALID_OTP for unknown email / wrong code
    if (!found) throw Errors.badRequest('That code is wrong or has expired.', 'INVALID_OTP');
    user = (await UserModel.findById(found._id).select('+passwordResetTokenHash +passwordResetExpiresAt'))!;
  }
  user.passwordHash = await hashPassword(input.newPassword);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();
  await UserModel.updateOne({ _id: user._id }, { $unset: { 'resetOtp.hash': 1, 'resetOtp.expiresAt': 1 } });
  await revokeAllSessions(user._id);
  audit('auth.password_reset', { userId: user._id });
  // The password is already changed and sessions revoked; a notification mail failing must not report the reset as failed.
  if (user.email) await sendMailBestEffort(mailTemplates.passwordChanged(user.email), 'password-changed');
  void notify(user._id, { type: 'ACCOUNT', title: 'Password changed', body: 'Your password was changed. You were signed out everywhere.' });
}

export type VerifyInput = { token: string } | { email: string; code: string };

export async function verifyEmail(input: VerifyInput): Promise<void> {
  if ('token' in input) {
    const user = await UserModel.findOneAndUpdate(
      { emailVerifyTokenHash: sha256(input.token), emailVerifyExpiresAt: { $gt: new Date() }, deletedAt: { $exists: false } },
      { $set: { emailVerified: true }, $unset: { emailVerifyTokenHash: 1, emailVerifyExpiresAt: 1 } },
    );
    if (!user) throw Errors.badRequest('This link has expired. Ask for a new one.', 'INVALID_VERIFY_TOKEN');
    audit('auth.email_verified', { userId: user._id });
    return;
  }
  const user = await UserModel.findOne({ email: input.email.toLowerCase(), deletedAt: { $exists: false } });
  await consumeOtp(user ? String(user._id) : null, 'verify', input.code);
  if (!user) throw Errors.badRequest('That code is wrong or has expired.', 'INVALID_OTP');
  await UserModel.updateOne({ _id: user._id }, { $set: { emailVerified: true }, $unset: { emailVerifyTokenHash: 1, emailVerifyExpiresAt: 1 } });
  audit('auth.email_verified', { userId: user._id, meta: { method: 'otp' } });
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user?.passwordHash) throw Errors.badRequest('This account has no password', 'NO_PASSWORD');
  if (!(await bcrypt.compare(current, user.passwordHash))) throw Errors.unauthorized('Your current password is wrong.', 'INVALID_CREDENTIALS');
  user.passwordHash = await hashPassword(next);
  await user.save();
  await revokeAllSessions(user._id);
  audit('auth.password_changed', { userId: user._id });
}

export { hashPassword };
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
