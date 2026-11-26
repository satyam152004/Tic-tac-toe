import { beforeEach, describe, expect, it } from '@jest/globals';
import { ApiError } from '../../src/services/api/errors';
import { useAuthStore } from '../../src/store/authStore';
import { meFixture } from '../mocks/onlineFixtures';

jest.mock('../../src/services/api/userApi', () => ({ userApi: { me: jest.fn() } }));
jest.mock('../../src/services/storage/secureStorage', () => ({
  tokenStorage: { load: jest.fn(), clear: jest.fn(async () => undefined), current: jest.fn(() => null), save: jest.fn() },
}));
jest.mock('../../src/services/socket/socketClient', () => ({ socketClient: { connect: jest.fn(), disconnect: jest.fn() } }));
jest.mock('../../src/services/queryClient', () => ({ queryClient: { clear: jest.fn() } }));
jest.mock('../../src/services/api/apiClient', () => ({ setSessionExpiredHandler: jest.fn() }));
jest.mock('../../src/services/api/authApi', () => ({ authApi: { logout: jest.fn(), logoutAll: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { userApi } = require('../../src/services/api/userApi') as { userApi: { me: jest.Mock } };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { tokenStorage } = require('../../src/services/storage/secureStorage') as { tokenStorage: { load: jest.Mock; clear: jest.Mock } };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsyncStorage = require('@react-native-async-storage/async-storage') as { getItem: jest.Mock };

const saved = { accessToken: '', refreshToken: 'r', tokenType: 'Bearer', expiresIn: 0, refreshExpiresAt: new Date(Date.now() + 86_400_000).toISOString() };
const st = () => useAuthStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ status: 'booting', user: null, offline: false, sessionExpired: false });
  tokenStorage.load.mockResolvedValue(saved);
  AsyncStorage.getItem.mockResolvedValue(null);
});

describe('startup session', () => {
  it('a server error keeps the saved login and opens the cached profile (no sign-out)', async () => {
    userApi.me.mockRejectedValue(new ApiError('INTERNAL', 'Server error'));
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(meFixture()));
    await st().bootstrap();
    expect(st().status).toBe('signedIn');
    expect(st().offline).toBe(true);
    expect(tokenStorage.clear).not.toHaveBeenCalled();
  });

  it('no network with a cached profile also keeps the login', async () => {
    userApi.me.mockRejectedValue(new ApiError('NETWORK_ERROR', 'No connection'));
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(meFixture()));
    await st().bootstrap();
    expect(st().status).toBe('signedIn');
    expect(tokenStorage.clear).not.toHaveBeenCalled();
  });

  it('signs out and clears the saved login only when the server rejects it', async () => {
    userApi.me.mockRejectedValue(new ApiError('REFRESH_TOKEN_EXPIRED', 'Your sign-in has expired.'));
    await st().bootstrap();
    expect(st().status).toBe('signedOut');
    expect(st().sessionExpired).toBe(true);
    expect(tokenStorage.clear).toHaveBeenCalled();
  });

  it('with no cached profile, keeps the login and retries startup instead of signing out', async () => {
    jest.useFakeTimers();
    try {
      userApi.me.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'No connection'));
      userApi.me.mockResolvedValueOnce(meFixture());
      await st().bootstrap();
      expect(st().status).toBe('booting');
      expect(tokenStorage.clear).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(2_000);
      expect(userApi.me).toHaveBeenCalledTimes(2);
      expect(st().status).toBe('signedIn');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('sign out', () => {
  it('logging out everywhere clears the saved login too', async () => {
    useAuthStore.setState({ status: 'signedIn', user: meFixture(), offline: false, sessionExpired: false });
    await st().logoutAll();
    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(st().status).toBe('signedOut');
  });
});
