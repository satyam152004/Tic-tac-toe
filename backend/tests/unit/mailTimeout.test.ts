import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// sendMail short-circuits under NODE_ENV=test, so this file loads a fresh copy of the config + mail module with a
// development environment and Brevo configured, and replaces only the network (global fetch).
const KEYS = ['NODE_ENV', 'BREVO_API_KEY', 'MAIL_TIMEOUT_MS', 'SMTP_HOST'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.NODE_ENV = 'development';
  process.env.BREVO_API_KEY = 'xkeysib-test-key';
  process.env.MAIL_TIMEOUT_MS = '1000';
  delete process.env.SMTP_HOST;
  vi.resetModules();
});
afterEach(() => {
  for (const k of KEYS) (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]));
  vi.unstubAllGlobals();
  vi.resetModules();
});

const mail = { to: 'a@example.com', subject: 's', text: 't' };

describe('Brevo delivery', () => {
  it('passes an abort signal so a hung provider cannot hold the request open', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const { sendMail } = await import('../../src/services/mail.service.js');
    await sendMail(mail);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('turns a timeout into MailDeliveryError (503 EMAIL_DELIVERY_FAILED)', async () => {
    // A fetch that never resolves on its own: it only settles when the request's abort signal fires.
    vi.stubGlobal(
      'fetch',
      (_url: string, init: RequestInit) =>
        new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(init.signal!.reason))),
    );
    const { sendMail, MailDeliveryError } = await import('../../src/services/mail.service.js');
    const started = Date.now();
    const err = await sendMail(mail).catch((e) => e);
    expect(err).toBeInstanceOf(MailDeliveryError);
    expect(err.status).toBe(503);
    expect(err.code).toBe('EMAIL_DELIVERY_FAILED');
    expect(Date.now() - started).toBeLessThan(4000);
  });

  it('turns a provider error status into MailDeliveryError without leaking the API key', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"message":"Key not found"}', { status: 401 }));
    const { sendMail, MailDeliveryError } = await import('../../src/services/mail.service.js');
    const err = await sendMail(mail).catch((e) => e);
    expect(err).toBeInstanceOf(MailDeliveryError);
    expect(JSON.stringify({ m: err.message, c: err.code })).not.toContain('xkeysib');
  });

  it('reports MailDeliveryError when no provider is configured in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_URI = 'mongodb://example/x';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    delete process.env.BREVO_API_KEY;
    vi.resetModules();
    const { sendMail, MailDeliveryError } = await import('../../src/services/mail.service.js');
    await expect(sendMail(mail)).rejects.toBeInstanceOf(MailDeliveryError);
    delete process.env.MONGODB_URI;
  });
});
