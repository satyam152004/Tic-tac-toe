import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RefreshTokenModel, UserModel } from '../../src/models/index.js';
import { testOutbox } from '../../src/services/mail.service.js';
import { socialVerifiers } from '../../src/services/social.service.js';
import { auth, clearDb, Env, registerUser, startEnv, stopEnv } from '../helpers.js';

let env: Env;
beforeAll(async () => void (env = await startEnv()));
afterAll(async () => stopEnv(env));
beforeEach(async () => {
  await clearDb();
  testOutbox.length = 0;
});

const api = () => request(env.app);
const creds = { email: 'alice@example.com', password: 'Passw0rdOK', username: 'alice' };

describe('registration & login', () => {
  it('registers a user, never exposes secrets, and stores only hashed refresh tokens', async () => {
    const res = await api().post('/api/v1/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const { user, tokens } = res.body.data;
    expect(user).toMatchObject({ username: 'alice', email: 'alice@example.com', accountType: 'REGISTERED' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    expect(tokens.accessToken).toBeTruthy();
    const stored = await RefreshTokenModel.find().lean();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tokenHash).not.toBe(tokens.refreshToken);
    expect(stored[0]!.tokenHash).toHaveLength(64);
    const dbUser = await UserModel.findOne({ username: 'alice' }).select('+passwordHash').lean();
    expect(dbUser!.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects duplicate email/username and weak input', async () => {
    await api().post('/api/v1/auth/register').send(creds);
    const dupEmail = await api().post('/api/v1/auth/register').send({ ...creds, username: 'other' });
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.body.error.code).toBe('EMAIL_TAKEN');
    const dupName = await api().post('/api/v1/auth/register').send({ ...creds, email: 'x@example.com', username: 'ALICE' });
    expect(dupName.body.error.code).toBe('USERNAME_TAKEN');
    const weak = await api().post('/api/v1/auth/register').send({ ...creds, email: 'y@example.com', username: 'yy1', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in with valid credentials and rejects invalid ones identically', async () => {
    await api().post('/api/v1/auth/register').send(creds);
    const ok = await api().post('/api/v1/auth/login').send({ email: creds.email, password: creds.password });
    expect(ok.status).toBe(200);
    const badPw = await api().post('/api/v1/auth/login').send({ email: creds.email, password: 'WrongPass1' });
    const noUser = await api().post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'WrongPass1' });
    expect(badPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(badPw.body.error).toEqual(noUser.body.error);
    expect(badPw.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('blocks NoSQL operator injection in credentials', async () => {
    await api().post('/api/v1/auth/register').send(creds);
    const res = await api().post('/api/v1/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
    const res2 = await api().post('/api/v1/auth/login').send({ email: creds.email, password: { $ne: null } });
    expect(res2.status).toBe(400);
  });
});

describe('access tokens', () => {
  it('requires a valid bearer token', async () => {
    expect((await api().get('/api/v1/users/me')).status).toBe(401);
    expect((await api().get('/api/v1/users/me').set('Authorization', 'Bearer garbage')).body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects expired tokens with TOKEN_EXPIRED', async () => {
    const u = await registerUser(env.app, 'exp');
    const expired = jwt.sign({ sid: 'x', act: 'REGISTERED', typ: 'access' }, process.env.JWT_ACCESS_SECRET!, { subject: u.id, expiresIn: -10, issuer: 'tictactoe-api' });
    const res = await api().get('/api/v1/users/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects tokens signed with another secret or algorithm none', async () => {
    const u = await registerUser(env.app, 'forged');
    const forged = jwt.sign({ sid: 'x', act: 'REGISTERED', typ: 'access' }, 'another-secret-another-secret-123456', { subject: u.id, issuer: 'tictactoe-api' });
    expect((await api().get('/api/v1/users/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
    const none = jwt.sign({ sid: 'x', typ: 'access' }, '', { subject: u.id, algorithm: 'none', issuer: 'tictactoe-api' });
    expect((await api().get('/api/v1/users/me').set('Authorization', `Bearer ${none}`)).status).toBe(401);
  });
});

describe('refresh token rotation', () => {
  it('rotates tokens and invalidates the previous refresh token', async () => {
    const u = await registerUser(env.app, 'rot');
    const r1 = await api().post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.data.refreshToken).not.toBe(u.refreshToken);
    const me = await api().get('/api/v1/users/me').set('Authorization', `Bearer ${r1.body.data.accessToken}`);
    expect(me.status).toBe(200);
    // New token works once more...
    const r2 = await api().post('/api/v1/auth/refresh').send({ refreshToken: r1.body.data.refreshToken });
    expect(r2.status).toBe(200);
  });

  it('detects reuse of a rotated token and revokes the whole session family', async () => {
    const u = await registerUser(env.app, 'reuse');
    const r1 = await api().post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken });
    const replay = await api().post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');
    // The legitimate newest token is now dead too (family revoked).
    const after = await api().post('/api/v1/auth/refresh').send({ refreshToken: r1.body.data.refreshToken });
    expect(after.status).toBe(401);
  });

  it('allows only one of two concurrent refreshes to succeed', async () => {
    const u = await registerUser(env.app, 'race');
    const results = await Promise.all([1, 2, 3].map(() => api().post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it('rejects unknown and expired refresh tokens', async () => {
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: 'x'.repeat(64) })).body.error.code).toBe('INVALID_REFRESH_TOKEN');
    const u = await registerUser(env.app, 'old');
    await RefreshTokenModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken })).body.error.code).toBe('REFRESH_TOKEN_EXPIRED');
  });
});

describe('logout', () => {
  it('logout revokes the session; logout-all revokes every device', async () => {
    const a = await registerUser(env.app, 'logo');
    const login2 = await api().post('/api/v1/auth/login').send({ email: 'logo@example.com', password: 'Passw0rdOK' });
    const second = login2.body.data.tokens;

    const out = await api().post('/api/v1/auth/logout').send({ refreshToken: a.refreshToken });
    expect(out.status).toBe(200);
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: a.refreshToken })).status).toBe(401);
    // Other device unaffected
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: second.refreshToken })).status).toBe(200);

    const login3 = await api().post('/api/v1/auth/login').send({ email: 'logo@example.com', password: 'Passw0rdOK' });
    const all = await api().post('/api/v1/auth/logout-all').set('Authorization', `Bearer ${login3.body.data.tokens.accessToken}`);
    expect(all.status).toBe(200);
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: login3.body.data.tokens.refreshToken })).status).toBe(401);
    expect(await RefreshTokenModel.countDocuments({ revokedAt: null })).toBe(0);
  });
});

describe('guest accounts', () => {
  it('creates a guest and upgrades it keeping the same user id', async () => {
    const g = await api().post('/api/v1/auth/guest').send({});
    expect(g.status).toBe(201);
    expect(g.body.data.user.accountType).toBe('GUEST');
    const guestToken = g.body.data.tokens.accessToken;
    const guestId = g.body.data.user.id;

    const up = await api().post('/api/v1/auth/upgrade').set('Authorization', `Bearer ${guestToken}`).send({ email: 'g@example.com', password: 'Passw0rdOK', username: 'was_guest' });
    expect(up.status).toBe(200);
    expect(up.body.data.user).toMatchObject({ id: guestId, accountType: 'REGISTERED', username: 'was_guest' });
    // old guest refresh token is dead, upgrading twice is refused
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: g.body.data.tokens.refreshToken })).status).toBe(401);
    const again = await api().post('/api/v1/auth/upgrade').set('Authorization', `Bearer ${up.body.data.tokens.accessToken}`).send({ email: 'g2@example.com', password: 'Passw0rdOK' });
    expect(again.body.error.code).toBe('ALREADY_REGISTERED');
    expect((await api().post('/api/v1/auth/login').send({ email: 'g@example.com', password: 'Passw0rdOK' })).status).toBe(200);
  });
});

describe('email verification and password reset', () => {
  const tokenFrom = (mail: { text: string }) => /Token: (\S+)/.exec(mail.text)![1]!;

  it('verifies email with the emailed token (single use)', async () => {
    await api().post('/api/v1/auth/register').send(creds);
    const mail = testOutbox.find((m) => /verification code/i.test(m.subject))!;
    expect(mail.to).toBe(creds.email);
    const token = tokenFrom(mail);
    expect((await api().post('/api/v1/auth/verify-email').send({ token })).status).toBe(200);
    expect((await api().post('/api/v1/auth/verify-email').send({ token })).body.error.code).toBe('INVALID_VERIFY_TOKEN');
    const user = await UserModel.findOne({ username: 'alice' }).lean();
    expect(user!.emailVerified).toBe(true);
  });

  it('forgot/reset password revokes sessions and never reveals whether an email exists', async () => {
    const u = await registerUser(env.app, 'pwuser');
    const known = await api().post('/api/v1/auth/forgot-password').send({ email: 'pwuser@example.com' });
    const unknown = await api().post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    const mails = testOutbox.filter((m) => /password reset code/i.test(m.subject));
    expect(mails).toHaveLength(1);
    const token = tokenFrom(mails[0]!);

    expect((await api().post('/api/v1/auth/reset-password').send({ token: 'z'.repeat(40), newPassword: 'NewPassw0rd' })).status).toBe(400);
    expect((await api().post('/api/v1/auth/reset-password').send({ token, newPassword: 'NewPassw0rd' })).status).toBe(200);
    expect((await api().post('/api/v1/auth/reset-password').send({ token, newPassword: 'Another1Pass' })).status).toBe(400); // single use
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken })).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ email: 'pwuser@example.com', password: 'Passw0rdOK' })).status).toBe(401);
    expect((await api().post('/api/v1/auth/login').send({ email: 'pwuser@example.com', password: 'NewPassw0rd' })).status).toBe(200);
  });
});

describe('social login', () => {
  it('creates and then reuses an account for a verified Google identity; links by verified email', async () => {
    const original = socialVerifiers.google;
    socialVerifiers.google = async (t) => ({ subject: `sub-${t}`, email: 'bob@example.com', emailVerified: true, name: 'Bob G' });
    try {
      const first = await api().post('/api/v1/auth/google').send({ idToken: 'a'.repeat(30) });
      expect(first.status).toBe(200);
      const second = await api().post('/api/v1/auth/google').send({ idToken: 'a'.repeat(30) });
      expect(second.body.data.user.id).toBe(first.body.data.user.id);
      expect(await UserModel.countDocuments()).toBe(1);

      await registerUser(env.app, 'carl');
      socialVerifiers.google = async () => ({ subject: 'carl-sub', email: 'carl@example.com', emailVerified: true });
      const linked = await api().post('/api/v1/auth/google').send({ idToken: 'b'.repeat(30) });
      expect(linked.body.data.user.username).toBe('carl');
    } finally {
      socialVerifiers.google = original;
    }
  });

  it('does not let a pre-registered, unverified account survive being linked to the real owner (pre-hijacking)', async () => {
    const attacker = await registerUser(env.app, 'victimz'); // registers victimz@example.com, never verified
    const original = socialVerifiers.google;
    socialVerifiers.google = async () => ({ subject: 'real-owner', email: 'victimz@example.com', emailVerified: true });
    try {
      const res = await api().post('/api/v1/auth/google').send({ idToken: 'd'.repeat(30) });
      expect(res.status).toBe(200);
      // the attacker's password and sessions are gone
      expect((await api().post('/api/v1/auth/login').send({ email: 'victimz@example.com', password: 'Passw0rdOK' })).status).toBe(401);
      expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: attacker.refreshToken })).status).toBe(401);
      // the real owner keeps working
      expect((await api().get('/api/v1/users/me').set('Authorization', `Bearer ${res.body.data.tokens.accessToken}`)).body.data.emailVerified).toBe(true);
    } finally {
      socialVerifiers.google = original;
    }
  });

  it('refuses unconfigured providers', async () => {
    const res = await api().post('/api/v1/auth/apple').send({ identityToken: 'c'.repeat(30) });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });
});

describe('profile & account management', () => {
  it('updates profile + preferences and validates input', async () => {
    const u = await registerUser(env.app, 'prof');
    const res = await api().patch('/api/v1/users/me').set(auth(u)).send({ displayName: 'Prof X', theme: 'dark', language: 'fr', sound: { volume: 0.3, music: false }, notificationPrefs: { social: false } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ displayName: 'Prof X', theme: 'dark', language: 'fr', sound: { volume: 0.3, music: false, effects: true }, notificationPrefs: { social: false, game: true } });
    expect((await api().patch('/api/v1/users/me').set(auth(u)).send({ theme: 'bogus' })).status).toBe(400);
    expect((await api().patch('/api/v1/users/me').set(auth(u)).send({ stats: { wins: 999 } })).status).toBe(400); // cannot edit own stats
    expect((await api().patch('/api/v1/users/me').set(auth(u)).send({})).status).toBe(400);
    const me = await api().get('/api/v1/users/me').set(auth(u));
    expect(me.body.data.stats.wins).toBe(0);
  });

  it('exposes only public fields for other players', async () => {
    const a = await registerUser(env.app, 'pla');
    const b = await registerUser(env.app, 'plb');
    const res = await api().get(`/api/v1/users/${b.id}`).set(auth(a));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBeUndefined();
    expect(res.body.data.username).toBe('plb');
    const search = await api().get('/api/v1/users/search?q=p').set(auth(a));
    expect(search.status).toBe(400); // min 2 chars
    const s2 = await api().get('/api/v1/users/search?q=plb').set(auth(a));
    expect(s2.body.data.map((x: { username: string }) => x.username)).toEqual(['plb']);
    const bad = await api().get('/api/v1/users/not-an-id').set(auth(a));
    expect(bad.status).toBe(400);
  });

  it('deletes an account after password confirmation and anonymises it', async () => {
    const u = await registerUser(env.app, 'del');
    expect((await api().delete('/api/v1/users/me').set(auth(u)).send({ password: 'wrong' })).status).toBe(401);
    const res = await api().delete('/api/v1/users/me').set(auth(u)).send({ password: 'Passw0rdOK' });
    expect(res.status).toBe(200);
    expect((await api().post('/api/v1/auth/login').send({ email: 'del@example.com', password: 'Passw0rdOK' })).status).toBe(401);
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: u.refreshToken })).status).toBe(401);
    const doc = await UserModel.findById(u.id).lean();
    expect(doc!.email).toBeUndefined();
    expect(doc!.displayName).toBe('Deleted Player');
    // email can be registered again
    expect((await api().post('/api/v1/auth/register').send({ email: 'del@example.com', password: 'Passw0rdOK', username: 'del2' })).status).toBe(201);
  });
});

describe('system', () => {
  it('serves health, version, docs and a JSON 404', async () => {
    expect((await api().get('/api/v1/health')).body.data.status).toBe('ok');
    expect((await api().get('/api/v1/version')).body.data.apiVersion).toBe('v1');
    const spec = await api().get('/api/openapi.json');
    expect(Object.keys(spec.body.paths).length).toBeGreaterThan(40);
    const nf = await api().get('/api/v1/nope');
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe('ROUTE_NOT_FOUND');
    const bad = await api().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_JSON');
  });

  it('sets security headers and honours the CORS allow-list', async () => {
    const res = await api().get('/api/v1/health').set('Origin', 'http://localhost:3000');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const evil = await api().get('/api/v1/health').set('Origin', 'http://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});
