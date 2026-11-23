import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UserModel } from '../../src/models/index.js';
import { testOutbox } from '../../src/services/mail.service.js';
import { socialVerifiers } from '../../src/services/social.service.js';
import { clearDb, Env, registerUser, startEnv, stopEnv } from '../helpers.js';

let env: Env;
const original = socialVerifiers.google;
beforeAll(async () => void (env = await startEnv()));
afterAll(async () => stopEnv(env));
beforeEach(async () => {
  await clearDb();
  testOutbox.length = 0;
});
afterEach(() => {
  socialVerifiers.google = original;
});

const api = () => request(env.app);
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const lastCode = () => /(\d{6})/.exec(testOutbox[testOutbox.length - 1]!.text)![1]!;
const asGoogle = (email: string | undefined, subject = 'g-sub-1', emailVerified = true) => {
  socialVerifiers.google = async () => ({ subject, email, emailVerified, name: 'Gina G' });
};
const googleLogin = () => api().post('/api/v1/auth/google').send({ idToken: 'g'.repeat(30) });

describe('Google account -> set a password', () => {
  it('cannot use email + password until a password is set; setting one keeps Google login working', async () => {
    asGoogle('gina@example.com');
    const first = await googleLogin();
    expect(first.status).toBe(200);
    expect(first.body.data.user.hasPassword).toBe(false);
    const { accessToken, refreshToken } = first.body.data.tokens;

    // generic failure: no hint that the account exists or uses Google
    const noPw = await api().post('/api/v1/auth/login').send({ email: 'gina@example.com', password: 'Passw0rdOK' });
    expect(noPw.status).toBe(401);
    expect(noPw.body.error.message).toBe('Invalid email or password');
    expect(noPw.body.error.code).toBe('INVALID_CREDENTIALS');

    // "Change password" does not apply (nothing to confirm)
    expect((await api().post('/api/v1/auth/change-password').set(bearer(accessToken)).send({ currentPassword: 'x', newPassword: 'NewPassw0rd' })).body.error.code).toBe('NO_PASSWORD');

    // proof of email ownership first
    const req = await api().post('/api/v1/auth/set-password/request').set(bearer(accessToken));
    expect(req.status).toBe(200);
    expect(testOutbox[testOutbox.length - 1]!.to).toBe('gina@example.com');
    const code = lastCode();

    const wrong = await api().post('/api/v1/auth/set-password').set(bearer(accessToken)).send({ code: code === '000000' ? '111111' : '000000', newPassword: 'NewPassw0rd' });
    expect(wrong.body.error.code).toBe('INVALID_OTP');

    const done = await api().post('/api/v1/auth/set-password').set(bearer(accessToken)).send({ code, newPassword: 'NewPassw0rd' });
    expect(done.status).toBe(200);
    expect(done.body.data.user.hasPassword).toBe(true);
    expect(done.body.data.user.id).toBe(first.body.data.user.id);

    // old sessions are gone, the fresh ones work
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken })).status).toBe(401);
    expect((await api().get('/api/v1/users/me').set(bearer(done.body.data.tokens.accessToken))).body.data.hasPassword).toBe(true);

    // both methods now log into the SAME account
    const viaPw = await api().post('/api/v1/auth/login').send({ email: 'gina@example.com', password: 'NewPassw0rd' });
    expect(viaPw.status).toBe(200);
    expect(viaPw.body.data.user.id).toBe(first.body.data.user.id);
    expect((await googleLogin()).body.data.user.id).toBe(first.body.data.user.id);
    expect(await UserModel.countDocuments()).toBe(1);

    // a password can only be added once; afterwards it is "change password"
    expect((await api().post('/api/v1/auth/set-password/request').set(bearer(done.body.data.tokens.accessToken))).body.error.code).toBe('PASSWORD_ALREADY_SET');
  });

  it('is refused for guests and for accounts that already have a password', async () => {
    const guest = await api().post('/api/v1/auth/guest').send({});
    expect((await api().post('/api/v1/auth/set-password/request').set(bearer(guest.body.data.tokens.accessToken))).body.error.code).toBe('NOT_REGISTERED');

    const u = await registerUser(env.app, 'haspw');
    const me = await api().get('/api/v1/users/me').set(bearer(u.token));
    expect(me.body.data.hasPassword).toBe(true);
    expect((await api().post('/api/v1/auth/set-password/request').set(bearer(u.token))).body.error.code).toBe('PASSWORD_ALREADY_SET');
    expect((await api().post('/api/v1/auth/set-password').set(bearer(u.token)).send({ code: '123456', newPassword: 'NewPassw0rd' })).body.error.code).toBe('PASSWORD_ALREADY_SET');
    expect((await api().post('/api/v1/auth/set-password/request')).status).toBe(401);
  });
});

describe('guest -> Google upgrade', () => {
  it('keeps the same account, coins and progress, and revokes the guest sessions', async () => {
    const guest = await api().post('/api/v1/auth/guest').send({});
    const gid = guest.body.data.user.id;
    await UserModel.updateOne({ _id: gid }, { $set: { 'wallet.coins': 777, 'stats.totalGames': 5 } });
    expect(guest.body.data.user.accountType).toBe('GUEST');

    asGoogle('upgrader@example.com');
    const res = await api().post('/api/v1/auth/upgrade/google').set(bearer(guest.body.data.tokens.accessToken)).send({ idToken: 'g'.repeat(30) });
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(gid);
    expect(res.body.data.user.accountType).toBe('REGISTERED');
    expect(res.body.data.user.email).toBe('upgrader@example.com');
    expect(res.body.data.user.emailVerified).toBe(true);
    expect(res.body.data.user.hasPassword).toBe(false);
    expect(res.body.data.user.wallet.coins).toBe(777);
    expect(res.body.data.user.stats.totalGames).toBe(5);
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: guest.body.data.tokens.refreshToken })).status).toBe(401);

    // later Google logins land on the upgraded account
    expect((await googleLogin()).body.data.user.id).toBe(gid);
    expect(await UserModel.countDocuments()).toBe(1);
    // and it can no longer be "upgraded" again
    const again = await api().post('/api/v1/auth/upgrade/google').set(bearer(res.body.data.tokens.accessToken)).send({ idToken: 'g'.repeat(30) });
    expect(again.body.error.code).toBe('ALREADY_REGISTERED');
  });

  it('never merges accounts: an identity or email that already exists is refused and the guest is untouched', async () => {
    asGoogle('owner@example.com', 'owner-sub');
    const owner = await googleLogin();
    expect(owner.status).toBe(200);

    const guest = await api().post('/api/v1/auth/guest').send({});
    const tok = guest.body.data.tokens.accessToken;
    const linked = await api().post('/api/v1/auth/upgrade/google').set(bearer(tok)).send({ idToken: 'g'.repeat(30) });
    expect(linked.status).toBe(409);
    expect(linked.body.error.code).toBe('SOCIAL_ALREADY_LINKED');

    await registerUser(env.app, 'taken'); // taken@example.com
    asGoogle('taken@example.com', 'other-sub');
    const taken = await api().post('/api/v1/auth/upgrade/google').set(bearer(tok)).send({ idToken: 'g'.repeat(30) });
    expect(taken.body.error.code).toBe('EMAIL_TAKEN');

    asGoogle(undefined, 'noemail-sub');
    expect((await api().post('/api/v1/auth/upgrade/google').set(bearer(tok)).send({ idToken: 'g'.repeat(30) })).body.error.code).toBe('SOCIAL_EMAIL_REQUIRED');

    // still a working guest
    const me = await api().get('/api/v1/users/me').set(bearer(tok));
    expect(me.status).toBe(200);
    expect(me.body.data.accountType).toBe('GUEST');
    expect((await api().post('/api/v1/auth/upgrade/google').send({ idToken: 'g'.repeat(30) })).status).toBe(401);
  });
});
