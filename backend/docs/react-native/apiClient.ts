import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_BASE, REQUEST_TIMEOUT_MS } from './config';
import { ApiError, SESSION_DEAD_CODES, toApiError } from './errors';
import { tokenStorage } from './tokenStorage';
import type { ApiSuccess, AuthResult, Game, Me, MoveResult, Tokens } from './types';

/** Called when the refresh token is rejected: navigate to the login screen. */
let onSessionExpired: () => void = () => undefined;
export const setSessionExpiredHandler = (fn: () => void) => (onSessionExpired = fn);

export const api: AxiosInstance = axios.create({ baseURL: API_BASE, timeout: REQUEST_TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } });

// Separate client without interceptors for the refresh call itself (prevents refresh loops).
const bare = axios.create({ baseURL: API_BASE, timeout: REQUEST_TIMEOUT_MS });

/** Single-flight refresh: concurrent 401s share ONE refresh request (refresh tokens rotate, a second call would be a "reuse"). */
let refreshing: Promise<Tokens> | null = null;

export function refreshTokens(): Promise<Tokens> {
  refreshing ??= (async () => {
    const current = tokenStorage.current() ?? (await tokenStorage.load());
    if (!current) throw new ApiError('INVALID_REFRESH_TOKEN', 'Not logged in');
    try {
      const res = await bare.post<ApiSuccess<Tokens>>('/auth/refresh', { refreshToken: current.refreshToken });
      await tokenStorage.save(res.data.data); // persists the NEW refresh token; the old one is dead
      return res.data.data;
    } catch (e) {
      const err = toApiError(e);
      if (SESSION_DEAD_CODES.has(err.code)) {
        await tokenStorage.clear();
        onSessionExpired();
      }
      throw err;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// ---- request interceptor: attach the in-memory access token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const t = tokenStorage.current();
  if (t) config.headers.Authorization = `Bearer ${t.accessToken}`;
  return config;
});

// ---- response interceptor: on TOKEN_EXPIRED refresh once, then replay the original request
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<{ error?: { code?: string } }>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const code = error.response?.data?.error?.code;
    if (error.response?.status === 401 && code === 'TOKEN_EXPIRED' && original && !original._retried) {
      original._retried = true;
      const t = await refreshTokens();
      original.headers.Authorization = `Bearer ${t.accessToken}`;
      return api(original);
    }
    throw toApiError(error);
  },
);

const unwrap = async <T>(p: Promise<{ data: ApiSuccess<T> }>): Promise<T> => (await p).data.data;

// ---------------------------------------------------------------- typed helpers
export const Auth = {
  async guest(): Promise<AuthResult> {
    const r = await unwrap<AuthResult>(bare.post('/auth/guest', {}));
    await tokenStorage.save(r.tokens);
    return r;
  },
  async register(input: { email: string; password: string; username: string }): Promise<AuthResult> {
    const r = await unwrap<AuthResult>(bare.post('/auth/register', input).catch((e) => Promise.reject(toApiError(e))));
    await tokenStorage.save(r.tokens);
    return r;
  },
  async login(email: string, password: string): Promise<AuthResult> {
    const r = await unwrap<AuthResult>(bare.post('/auth/login', { email, password }).catch((e) => Promise.reject(toApiError(e))));
    await tokenStorage.save(r.tokens);
    return r;
  },
  /** Guest -> registered account; keeps all progress. */
  async upgradeGuest(input: { email: string; password: string; username?: string }): Promise<AuthResult> {
    const r = await unwrap<AuthResult>(api.post('/auth/upgrade', input));
    await tokenStorage.save(r.tokens);
    return r;
  },
  async logout(): Promise<void> {
    const t = tokenStorage.current();
    if (t) await bare.post('/auth/logout', { refreshToken: t.refreshToken }).catch(() => undefined); // best effort
    await tokenStorage.clear();
  },
};

export const Users = { me: () => unwrap<Me>(api.get('/users/me')) };

export const Games = {
  createAi: (input: { boardSize: 3 | 4 | 5; difficulty: string; winLength?: number; humanMark?: 'X' | 'O' | 'RANDOM' }) =>
    unwrap<Game>(api.post('/games', { type: 'AI', ...input })),
  get: (id: string) => unwrap<Game>(api.get(`/games/${id}`)),
  active: () => unwrap<Game[]>(api.get('/games/active')),
  /** REST fallback for moves (sockets are preferred while connected). Reuse `clientMoveId` when retrying. */
  move: (gameId: string, position: number, clientMoveId: string) => unwrap<MoveResult>(api.post(`/games/${gameId}/moves`, { position, clientMoveId })),
  forfeit: (id: string) => unwrap<Game>(api.post(`/games/${id}/forfeit`)),
};

export const Devices = {
  register: (token: string, platform: 'android' | 'ios') => unwrap<{ id: string }>(api.post('/devices/register', { token, platform })),
  remove: (id: string) => api.delete(`/devices/${id}`),
};

/** Offline matches recorded on the device -> verified by the server (idempotent per clientMatchId). */
export const syncLocalMatches = (matches: unknown[]) => unwrap<{ accepted: number; duplicates: number; rejected: unknown[] }>(api.post('/statistics/me/local-matches', { matches }));
