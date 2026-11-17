import MockAdapter from 'axios-mock-adapter';
import * as SecureStore from 'expo-secure-store';
import { api, bare, refreshTokens, setSessionExpiredHandler } from '../../src/services/api/apiClient';
import { ApiError, toApiError } from '../../src/services/api/errors';
import { authApi } from '../../src/services/api/authApi';
import { tokenStorage } from '../../src/services/storage/secureStorage';

const tokens = (n: number) => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  tokenType: 'Bearer' as const,
  expiresIn: 900,
  refreshExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
});

const ok = <T,>(data: T) => [200, { success: true, data }] as [number, unknown];
let apiMock: MockAdapter;
let bareMock: MockAdapter;

beforeEach(async () => {
  apiMock = new MockAdapter(api);
  bareMock = new MockAdapter(bare);
  await tokenStorage.clear();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  setSessionExpiredHandler(() => undefined);
});
afterEach(() => {
  apiMock.restore();
  bareMock.restore();
});

describe('secure token storage', () => {
  it('persists ONLY the refresh token (never the access token) in SecureStore and restores it', async () => {
    await tokenStorage.save(tokens(1));
    const raw = (SecureStore as unknown as { __store: Map<string, string> }).__store.get('tictactoe.session.v1')!;
    expect(raw).toContain('refresh-1');
    expect(raw).not.toContain('access-1');
    // simulate an app restart
    (tokenStorage as unknown as { current: () => unknown }).current();
    await tokenStorage.clear();
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set('tictactoe.session.v1', raw);
    const loaded = await tokenStorage.load();
    expect(loaded?.refreshToken).toBe('refresh-1');
    expect(loaded?.accessToken).toBe('');
  });

  it('drops an expired persisted refresh token', async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set('tictactoe.session.v1', JSON.stringify({ refreshToken: 'old', refreshExpiresAt: new Date(Date.now() - 1000).toISOString() }));
    expect(await tokenStorage.load()).toBeNull();
  });
});

describe('request interceptor + refresh', () => {
  it('attaches the bearer token', async () => {
    await tokenStorage.save(tokens(1));
    apiMock.onGet('/users/me').reply((cfg) => ok({ auth: cfg.headers?.Authorization }));
    const res = await api.get('/users/me');
    expect(res.data.data.auth).toBe('Bearer access-1');
  });

  it('on TOKEN_EXPIRED refreshes once, rotates the stored refresh token and replays the request', async () => {
    await tokenStorage.save(tokens(1));
    let calls = 0;
    apiMock.onGet('/users/me').reply((cfg) => {
      calls++;
      return cfg.headers?.Authorization === 'Bearer access-2' ? ok({ id: 'u1' }) : [401, { success: false, error: { code: 'TOKEN_EXPIRED', message: 'expired' } }];
    });
    bareMock.onPost('/auth/refresh').reply(() => ok(tokens(2)));
    const res = await api.get('/users/me');
    expect(res.data.data.id).toBe('u1');
    expect(calls).toBe(2);
    expect(tokenStorage.current()?.refreshToken).toBe('refresh-2');
    expect(bareMock.history.post).toHaveLength(1);
    expect(JSON.parse(bareMock.history.post[0]!.data).refreshToken).toBe('refresh-1');
  });

  it('shares ONE refresh request between concurrent expired requests (rotation safety)', async () => {
    await tokenStorage.save(tokens(1));
    apiMock.onGet(/\/(a|b|c)$/).reply((cfg) => (cfg.headers?.Authorization === 'Bearer access-2' ? ok({ ok: true }) : [401, { success: false, error: { code: 'TOKEN_EXPIRED', message: 'x' } }]));
    bareMock.onPost('/auth/refresh').reply(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return ok(tokens(2));
    });
    const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    expect(results.every((r) => r.data.data.ok)).toBe(true);
    expect(bareMock.history.post).toHaveLength(1);
  });

  it('after an app restart (only a refresh token) obtains an access token before the first call', async () => {
    await tokenStorage.save(tokens(1));
    await tokenStorage.clear();
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set('tictactoe.session.v1', JSON.stringify({ refreshToken: 'refresh-1', refreshExpiresAt: tokens(1).refreshExpiresAt }));
    await tokenStorage.load();
    bareMock.onPost('/auth/refresh').reply(() => ok(tokens(2)));
    apiMock.onGet('/users/me').reply((cfg) => ok({ auth: cfg.headers?.Authorization }));
    const res = await api.get('/users/me');
    expect(res.data.data.auth).toBe('Bearer access-2');
  });

  it('a revoked/reused refresh token clears the session and notifies the app', async () => {
    await tokenStorage.save(tokens(1));
    const expired = jest.fn();
    setSessionExpiredHandler(expired);
    apiMock.onGet('/users/me').reply(401, { success: false, error: { code: 'TOKEN_EXPIRED', message: 'x' } });
    bareMock.onPost('/auth/refresh').reply(401, { success: false, error: { code: 'REFRESH_TOKEN_REUSED', message: 'reused' } });
    await expect(api.get('/users/me')).rejects.toMatchObject({ code: 'REFRESH_TOKEN_REUSED' });
    expect(expired).toHaveBeenCalledTimes(1);
    expect(tokenStorage.current()).toBeNull();
  });

  it('does not retry forever: a second 401 after refresh fails', async () => {
    await tokenStorage.save(tokens(1));
    apiMock.onGet('/users/me').reply(401, { success: false, error: { code: 'TOKEN_EXPIRED', message: 'x' } });
    bareMock.onPost('/auth/refresh').reply(() => ok(tokens(2)));
    await expect(api.get('/users/me')).rejects.toBeInstanceOf(ApiError);
    expect(bareMock.history.post).toHaveLength(1);
  });

  it('refresh without any stored session fails cleanly', async () => {
    await expect(refreshTokens()).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });
});

describe('error normalisation', () => {
  it('maps backend error envelopes, network failures and timeouts', async () => {
    apiMock.onGet('/x').reply(409, { success: false, error: { code: 'EMAIL_TAKEN', message: 'taken', details: { a: 1 } } });
    await expect(api.get('/x')).rejects.toMatchObject({ code: 'EMAIL_TAKEN', status: 409, details: { a: 1 } });
    apiMock.onGet('/y').networkError();
    await expect(api.get('/y')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    apiMock.onGet('/z').timeout();
    await expect(api.get('/z')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(toApiError(new Error('boom')).code).toBe('UNKNOWN');
  });
});

describe('authApi', () => {
  it('login stores tokens securely and returns the user', async () => {
    bareMock.onPost('/auth/login').reply(() => ok({ user: { id: 'u1' }, tokens: tokens(5) }));
    const r = await authApi.login('a@b.com', 'Passw0rdOK');
    expect(r.user.id).toBe('u1');
    expect(tokenStorage.current()?.accessToken).toBe('access-5');
  });

  it('logout revokes the session server-side and always clears local tokens (even offline)', async () => {
    await tokenStorage.save(tokens(1));
    bareMock.onPost('/auth/logout').networkError();
    await authApi.logout();
    expect(tokenStorage.current()).toBeNull();
    expect(await tokenStorage.load()).toBeNull();
  });

  it('login failure surfaces INVALID_CREDENTIALS and stores nothing', async () => {
    bareMock.onPost('/auth/login').reply(401, { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'bad' } });
    await expect(authApi.login('a@b.com', 'x')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(tokenStorage.current()).toBeNull();
  });
});
