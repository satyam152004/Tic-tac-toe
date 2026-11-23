import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OTP } from '../../src/constants/index.js';
import { RewardClaimModel, UserModel } from '../../src/models/index.js';
import { testOutbox } from '../../src/services/mail.service.js';
import { claimDaily, getDailyStatus, localDayKey, shiftDayKey } from '../../src/services/reward.service.js';
import { auth, clearDb, Env, registerUser, startEnv, stopEnv } from '../helpers.js';

let env: Env;
beforeAll(async () => void (env = await startEnv()));
afterAll(async () => stopEnv(env));
beforeEach(async () => {
  await clearDb();
  testOutbox.length = 0;
});

const api = () => request(env.app);
const creds = { email: 'otp@example.com', password: 'Passw0rdOK', username: 'otpuser' };
const codeFrom = (m: { text: string }) => /: ([0-9]{6})/.exec(m.text)![1]!;
const lastCode = () => codeFrom(testOutbox[testOutbox.length - 1]!);

describe('six-digit email OTP (verification)', () => {
  it('sends a 6-digit code on registration, never returns it from the API, and stores only a hash', async () => {
    const res = await api().post('/api/v1/auth/register').send(creds);
    expect(res.status).toBe(201);
    const code = lastCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(res.body)).not.toContain(code);
    const raw = await UserModel.findOne({ username: 'otpuser' }).select('+emailOtp').lean();
    expect(raw!.emailOtp!.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(raw!.emailOtp)).not.toContain(code);
    expect(raw!.emailOtp!.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(raw!.emailOtp!.expiresAt!.getTime()).toBeLessThanOrEqual(Date.now() + OTP.TTL_MS + 1000);
  });

  it('verifies with the right code (single use) and exposes no OTP state in profiles', async () => {
    const reg = await api().post('/api/v1/auth/register').send(creds);
    const code = lastCode();
    const ok = await api().post('/api/v1/auth/verify-email').send({ email: creds.email, code });
    expect(ok.status).toBe(200);
    expect((await UserModel.findOne({ username: 'otpuser' }).lean())!.emailVerified).toBe(true);
    const replay = await api().post('/api/v1/auth/verify-email').send({ email: creds.email, code });
    expect(replay.status).toBe(400);
    expect(replay.body.error.code).toBe('INVALID_OTP');
    const me = await api().get('/api/v1/users/me').set({ Authorization: `Bearer ${reg.body.data.tokens.accessToken}` });
    expect(JSON.stringify(me.body)).not.toMatch(/emailOtp|resetOtp|"hash"|passwordHash/);
    expect(me.body.data.emailVerified).toBe(true);
  });

  it('rejects wrong codes, reports attempts left, and locks the code after 5 wrong attempts', async () => {
    await api().post('/api/v1/auth/register').send(creds);
    const good = lastCode();
    const wrong = good === '000000' ? '111111' : '000000';
    const first = await api().post('/api/v1/auth/verify-email').send({ email: creds.email, code: wrong });
    expect(first.body.error.code).toBe('INVALID_OTP');
    expect(first.body.error.details.attemptsLeft).toBe(4);
    for (let i = 0; i < 3; i++) await api().post('/api/v1/auth/verify-email').send({ email: creds.email, code: wrong });
    const locked = await api().post('/api/v1/auth/verify-email').send({ email: creds.email, code: wrong });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('OTP_LOCKED');
    // even the correct code no longer works once locked
    const after = await api().post('/api/v1/auth/verify-email').send({ email: creds.email, code: good });
    expect(after.status).toBe(400);
    expect((await UserModel.findOne({ username: 'otpuser' }).lean())!.emailVerified).toBe(false);
  });

  it('rejects expired codes and unknown emails with the same error', async () => {
    await api().post('/api/v1/auth/register').send(creds);
    const code = lastCode();
    await UserModel.updateOne({ username: 'otpuser' }, { $set: { 'emailOtp.expiresAt': new Date(Date.now() - 1000) } });
    const expired = await api().post('/api/v1/auth/verify-email').send({ email: creds.email, code });
    const unknown = await api().post('/api/v1/auth/verify-email').send({ email: 'nobody@example.com', code });
    expect(expired.body.error.code).toBe('INVALID_OTP');
    expect(unknown.body.error.code).toBe('INVALID_OTP');
    expect(unknown.body.error.message).toBe(expired.body.error.message);
  });

  it('validates the code format', async () => {
    const res = await api().post('/api/v1/auth/verify-email').send({ email: creds.email, code: '12ab56' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('enforces the resend cooldown and the hourly cap, and a new code invalidates the old one', async () => {
    const reg = await api().post('/api/v1/auth/register').send(creds);
    const token = reg.body.data.tokens.accessToken;
    const first = lastCode();
    const tooSoon = await api().post('/api/v1/auth/resend-verification').set({ Authorization: `Bearer ${token}` });
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.error.code).toBe('OTP_COOLDOWN');

    for (let i = 0; i < 4; i++) {
      await UserModel.updateOne({ username: 'otpuser' }, { $set: { 'emailOtp.sentAt': new Date(Date.now() - OTP.RESEND_COOLDOWN_MS - 1000) } });
      const r = await api().post('/api/v1/auth/resend-verification').set({ Authorization: `Bearer ${token}` });
      expect(r.status).toBe(200);
      expect(r.body.data.retryAfterSec).toBe(60);
    }
    await UserModel.updateOne({ username: 'otpuser' }, { $set: { 'emailOtp.sentAt': new Date(Date.now() - OTP.RESEND_COOLDOWN_MS - 1000) } });
    const capped = await api().post('/api/v1/auth/resend-verification').set({ Authorization: `Bearer ${token}` });
    expect(capped.status).toBe(429);
    expect(capped.body.error.code).toBe('OTP_RATE_LIMITED');

    const latest = lastCode();
    if (latest !== first) {
      expect((await api().post('/api/v1/auth/verify-email').send({ email: creds.email, code: first })).status).toBe(400);
    }
    expect((await api().post('/api/v1/auth/verify-email').send({ email: creds.email, code: latest })).status).toBe(200);
    const again = await api().post('/api/v1/auth/resend-verification').set({ Authorization: `Bearer ${token}` });
    expect(again.body.error.code).toBe('ALREADY_VERIFIED');
  });

  it('two concurrent verifications with the right code: exactly one succeeds', async () => {
    await api().post('/api/v1/auth/register').send(creds);
    const code = lastCode();
    const rs = await Promise.all([1, 2, 3].map(() => api().post('/api/v1/auth/verify-email').send({ email: creds.email, code })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
  });
});

describe('six-digit email OTP (password reset)', () => {
  it('resets the password with email + code, revokes sessions, and is single use', async () => {
    const u = await registerUser(env.app, 'resetotp');
    testOutbox.length = 0;
    expect((await api().post('/api/v1/auth/forgot-password').send({ email: 'resetotp@example.com' })).status).toBe(200);
    const code = lastCode();
    const bad = await api().post('/api/v1/auth/reset-password').send({ email: 'resetotp@example.com', code: code === '123456' ? '654321' : '123456', newPassword: 'NewPassw0rd' });
    expect(bad.body.error.code).toBe('INVALID_OTP');
    const ok = await api().post('/api/v1/auth/reset-password').send({ email: 'resetotp@example.com', code, newPassword: 'NewPassw0rd' });
    expect(ok.status).toBe(200);
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken })).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ email: 'resetotp@example.com', password: 'NewPassw0rd' })).status).toBe(200);
    const replay = await api().post('/api/v1/auth/reset-password').send({ email: 'resetotp@example.com', code, newPassword: 'Another1Pass' });
    expect(replay.status).toBe(400);
  });

  it('forgot-password stays silent for unknown emails (no enumeration, no mail)', async () => {
    const r = await api().post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(r.status).toBe(200);
    expect(testOutbox).toHaveLength(0);
    const reset = await api().post('/api/v1/auth/reset-password').send({ email: 'ghost@example.com', code: '123456', newPassword: 'NewPassw0rd' });
    expect(reset.body.error.code).toBe('INVALID_OTP');
  });
});

describe('profile: bio, timezone, themes', () => {
  it('accepts all six themes, rejects others, stores a bio', async () => {
    const u = await registerUser(env.app, 'themer');
    for (const theme of ['dark', 'light', 'classic', 'neon', 'ocean', 'sunset']) {
      const r = await api().patch('/api/v1/users/me').set(auth(u)).send({ theme });
      expect(r.status).toBe(200);
      expect(r.body.data.theme).toBe(theme);
    }
    expect((await api().patch('/api/v1/users/me').set(auth(u)).send({ theme: 'rainbow' })).status).toBe(400);
    const bio = await api().patch('/api/v1/users/me').set(auth(u)).send({ bio: 'Tactical strategist' });
    expect(bio.body.data.bio).toBe('Tactical strategist');
    expect((await api().patch('/api/v1/users/me').set(auth(u)).send({ bio: 'x'.repeat(161) })).status).toBe(400);
    const pub = await api().get(`/api/v1/users/${u.id}`).set(auth(u));
    expect(pub.body.data.bio).toBe('Tactical strategist');
  });

  it('validates timezones and rate limits changing them', async () => {
    const u = await registerUser(env.app, 'tzuser');
    expect((await api().patch('/api/v1/users/me').set(auth(u)).send({ timezone: 'Mars/Olympus' })).status).toBe(400);
    expect((await api().patch('/api/v1/users/me').set(auth(u)).send({ timezone: 'Asia/Kolkata' })).body.data.timezone).toBe('Asia/Kolkata');
    const again = await api().patch('/api/v1/users/me').set(auth(u)).send({ timezone: 'America/New_York' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('TIMEZONE_CHANGE_LIMITED');
    // same zone again is a no-op, not an error
    expect((await api().patch('/api/v1/users/me').set(auth(u)).send({ timezone: 'Asia/Kolkata' })).status).toBe(200);
  });
});

describe('daily rewards', () => {
  const day = (iso: string) => new Date(iso);

  it('day key follows the user timezone and handles month boundaries', () => {
    const t = day('2026-03-01T01:30:00Z');
    expect(localDayKey(t, 'UTC')).toBe('2026-03-01');
    expect(localDayKey(t, 'America/Los_Angeles')).toBe('2026-02-28');
    expect(localDayKey(t, 'Pacific/Kiritimati')).toBe('2026-03-01');
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('first claim is day 1; second claim the same local day is refused; coins are credited by the server only', async () => {
    const u = await registerUser(env.app, 'claimer');
    const status = await api().get('/api/v1/rewards/daily').set(auth(u));
    expect(status.status).toBe(200);
    expect(status.body.data).toMatchObject({ canClaim: true, nextDay: 1, streak: 0, coins: 0 });
    expect(status.body.data.cycle.map((c: { status: string }) => c.status)).toEqual(['claimable', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(status.body.data.cycle.map((c: { coins: number }) => c.coins)).toEqual([100, 150, 200, 250, 350, 450, 750]);

    const claim = await api().post('/api/v1/rewards/daily/claim').set(auth(u)).send({ coins: 999999, day: 7 });
    expect(claim.status).toBe(200);
    expect(claim.body.data.claimed).toEqual({ day: 1, coins: 100 }); // client-supplied values are ignored
    expect(claim.body.data.wallet.coins).toBe(100);

    const again = await api().post('/api/v1/rewards/daily/claim').set(auth(u));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('REWARD_ALREADY_CLAIMED');
    expect(again.body.error.details.nextClaimAt).toBeTruthy();
    expect((await api().get('/api/v1/users/me').set(auth(u))).body.data.wallet.coins).toBe(100);
    expect(await RewardClaimModel.countDocuments({ userId: u.id })).toBe(1);
  });

  it('concurrent claims credit exactly once', async () => {
    const u = await registerUser(env.app, 'racer');
    const rs = await Promise.all(Array.from({ length: 6 }, () => api().post('/api/v1/rewards/daily/claim').set(auth(u))));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(5);
    expect((await UserModel.findById(u.id).lean())!.wallet!.coins).toBe(100);
    expect(await RewardClaimModel.countDocuments({ userId: u.id })).toBe(1);
  });

  it('consecutive local days advance the cycle, day 7 wraps to day 1, a skipped day resets', async () => {
    const u = await registerUser(env.app, 'streaker');
    await UserModel.updateOne({ _id: u.id }, { $set: { timezone: 'Asia/Kolkata' } });
    const t0 = day('2026-06-01T10:00:00Z'); // 15:30 IST
    const expected = [100, 150, 200, 250, 350, 450, 750, 100];
    for (let i = 0; i < 8; i++) {
      const r = await claimDaily(u.id, new Date(t0.getTime() + i * 24 * 3600_000));
      expect(r.claimed.coins).toBe(expected[i]);
      expect(r.claimed.day).toBe((i % 7) + 1);
    }
    expect((await UserModel.findById(u.id).lean())!.wallet!.coins).toBe(expected.reduce((a, b) => a + b, 0));
    // skip a whole local day -> back to day 1
    const afterGap = await claimDaily(u.id, new Date(t0.getTime() + 10 * 24 * 3600_000));
    expect(afterGap.claimed).toEqual({ day: 1, coins: 100 });
  });

  it('cycle statuses reflect claimed days mid-streak and after the day rolls over', async () => {
    const u = await registerUser(env.app, 'cycler');
    const t0 = day('2026-06-01T12:00:00Z');
    await claimDaily(u.id, t0);
    await claimDaily(u.id, new Date(t0.getTime() + 24 * 3600_000));
    const sameDay = await getDailyStatus(u.id, new Date(t0.getTime() + 25 * 3600_000));
    expect(sameDay.cycle.map((c) => c.status)).toEqual(['claimed', 'claimed', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(sameDay.canClaim).toBe(false);
    expect(sameDay.nextClaimAt && new Date(sameDay.nextClaimAt).getTime()).toBeGreaterThan(t0.getTime() + 25 * 3600_000);
    const nextDay = await getDailyStatus(u.id, new Date(t0.getTime() + 48 * 3600_000));
    expect(nextDay.cycle.map((c) => c.status)).toEqual(['claimed', 'claimed', 'claimable', 'locked', 'locked', 'locked', 'locked']);
    expect(nextDay.nextDay).toBe(3);
    const reset = await getDailyStatus(u.id, new Date(t0.getTime() + 96 * 3600_000));
    expect(reset.cycle[0]!.status).toBe('claimable');
    expect(reset.streak).toBe(0);
  });

  it('requires authentication and lists claim history', async () => {
    expect((await api().get('/api/v1/rewards/daily')).status).toBe(401);
    expect((await api().post('/api/v1/rewards/daily/claim')).status).toBe(401);
    const u = await registerUser(env.app, 'historian');
    await api().post('/api/v1/rewards/daily/claim').set(auth(u));
    const h = await api().get('/api/v1/rewards/daily/history').set(auth(u));
    expect(h.body.data).toHaveLength(1);
    expect(h.body.data[0]).toMatchObject({ cycleDay: 1, coins: 100 });
  });
});

vi.setConfig({ testTimeout: 30000 });
