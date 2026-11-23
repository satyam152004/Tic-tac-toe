import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserModel } from '../../src/models/index.js';
import { clearDb, Env, startEnv, stopEnv } from '../helpers.js';

const mode = vi.hoisted(() => ({ fail: false }));

// Simulates a provider outage by making the real mail module throw its real delivery error.
vi.mock('../../src/services/mail.service.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/services/mail.service.js')>();
  return {
    ...orig,
    sendMail: vi.fn(async (mail: Parameters<typeof orig.sendMail>[0]) => {
      if (mode.fail) throw new orig.MailDeliveryError();
      return orig.sendMail(mail);
    }),
  };
});

const { testOutbox } = await import('../../src/services/mail.service.js');

let env: Env;
beforeAll(async () => void (env = await startEnv()));
afterAll(async () => stopEnv(env));
beforeEach(async () => {
  await clearDb();
  testOutbox.length = 0;
  mode.fail = false;
});

const api = () => request(env.app);
const creds = { email: 'mailfail@example.com', password: 'Passw0rdOK', username: 'mailfail' };

describe('email provider outage', () => {
  it('registration still succeeds (no half-created account that answers EMAIL_TAKEN on retry)', async () => {
    mode.fail = true;
    const res = await api().post('/api/v1/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(await UserModel.countDocuments({ email: creds.email })).toBe(1);

    // the account is fully usable
    mode.fail = false;
    const login = await api().post('/api/v1/auth/login').send({ email: creds.email, password: creds.password });
    expect(login.status).toBe(200);
  });

  it('the user can get a new verification code after the outage', async () => {
    mode.fail = true;
    const reg = await api().post('/api/v1/auth/register').send(creds);
    const auth = { Authorization: `Bearer ${reg.body.data.tokens.accessToken}` };
    mode.fail = false;
    // the failed first send still consumed the cooldown window; clear it to model "a minute later"
    await UserModel.updateOne({ email: creds.email }, { $unset: { 'emailOtp.sentAt': 1 } });
    const resend = await api().post('/api/v1/auth/resend-verification').set(auth);
    expect(resend.status).toBe(200);
    expect(testOutbox.at(-1)?.to).toBe(creds.email);
  });

  it('resend-verification reports a delivery failure explicitly (503 EMAIL_DELIVERY_FAILED, not a generic 500)', async () => {
    const reg = await api().post('/api/v1/auth/register').send(creds);
    const auth = { Authorization: `Bearer ${reg.body.data.tokens.accessToken}` };
    await UserModel.updateOne({ email: creds.email }, { $unset: { 'emailOtp.sentAt': 1 } });
    mode.fail = true;
    const res = await api().post('/api/v1/auth/resend-verification').set(auth);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('EMAIL_DELIVERY_FAILED');
  });

  it('forgot-password answers identically for known and unknown emails even when delivery fails (no enumeration)', async () => {
    await api().post('/api/v1/auth/register').send(creds);
    mode.fail = true;
    const known = await api().post('/api/v1/auth/forgot-password').send({ email: creds.email });
    const unknown = await api().post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual({ ...unknown.body, requestId: known.body.requestId });
  });

  it('a password reset completes even if the "password changed" notice cannot be sent', async () => {
    await api().post('/api/v1/auth/register').send(creds);
    await api().post('/api/v1/auth/forgot-password').send({ email: creds.email });
    const code = /: ([0-9]{6})/.exec(testOutbox.at(-1)!.text)![1]!;
    mode.fail = true; // only the follow-up notice fails
    const res = await api().post('/api/v1/auth/reset-password').send({ email: creds.email, code, newPassword: 'NewPassw0rd1' });
    expect(res.status).toBe(200);
    mode.fail = false;
    const login = await api().post('/api/v1/auth/login').send({ email: creds.email, password: 'NewPassw0rd1' });
    expect(login.status).toBe(200);
  });
});
