import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '../storage/secureStorage';
import { API_BASE, REQUEST_TIMEOUT_MS } from './config';
import { ApiError, SESSION_DEAD_CODES, toApiError } from './errors';
import type { ApiSuccess, Page, Tokens } from './types';

/** Called when the refresh token is rejected (revoked / expired / reused): the app routes to the login screen. */
let onSessionExpired: () => void = () => undefined;
export const setSessionExpiredHandler = (fn: () => void): void => {
  onSessionExpired = fn;
};

export const api: AxiosInstance = axios.create({ baseURL: API_BASE, timeout: REQUEST_TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } });

/** Interceptor-free client for public endpoints and for the refresh call itself (prevents refresh loops). */
export const bare: AxiosInstance = axios.create({ baseURL: API_BASE, timeout: REQUEST_TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } });

/**
 * Single-flight refresh: refresh tokens rotate, so concurrent 401s MUST share one refresh request.
 * A second parallel call with the old token would look like token reuse and revoke the whole session.
 */
let refreshing: Promise<Tokens> | null = null;

export function refreshTokens(): Promise<Tokens> {
  refreshing ??= (async () => {
    const current = tokenStorage.current() ?? (await tokenStorage.load());
    if (!current) throw new ApiError('INVALID_REFRESH_TOKEN', 'Not logged in');
    try {
      const res = await bare.post<ApiSuccess<Tokens>>('/auth/refresh', { refreshToken: current.refreshToken });
      await tokenStorage.save(res.data.data);
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

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  let t = tokenStorage.current();
  // After an app restart only the refresh token exists: get an access token before the first call.
  if (t && !t.accessToken) t = await refreshTokens().catch(() => null);
  if (t?.accessToken) config.headers.Authorization = `Bearer ${t.accessToken}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<{ error?: { code?: string } }>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const code = error.response?.data?.error?.code;
    if (error.response?.status === 401 && (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN') && original && !original._retried) {
      original._retried = true;
      const t = await refreshTokens();
      original.headers.Authorization = `Bearer ${t.accessToken}`;
      return api(original);
    }
    throw toApiError(error);
  },
);

export const unwrap = async <T>(p: Promise<AxiosResponse<ApiSuccess<T>>>): Promise<T> => (await p.catch((e) => Promise.reject(toApiError(e)))).data.data;

/** Paginated endpoints return `data: T[]` + `meta` -> normalise to { items, page, ... }. */
export const unwrapPage = async <T>(p: Promise<AxiosResponse<ApiSuccess<T[]>>>): Promise<Page<T> & { meta: Record<string, unknown> }> => {
  const r = (await p.catch((e) => Promise.reject(toApiError(e)))).data;
  const m = (r.meta ?? {}) as Record<string, number>;
  return { items: r.data, page: m.page ?? 1, limit: m.limit ?? r.data.length, total: m.total ?? r.data.length, totalPages: m.totalPages ?? 1, meta: (r.meta ?? {}) as Record<string, unknown> };
};
