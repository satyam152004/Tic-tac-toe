import { tokenStorage } from '../storage/secureStorage';
import { api, bare, unwrap } from './apiClient';
import type { AuthResult } from './types';

const persist = async (r: AuthResult): Promise<AuthResult> => {
  await tokenStorage.save(r.tokens);
  return r;
};

export const authApi = {
  guest: (displayName?: string) => unwrap<AuthResult>(bare.post('/auth/guest', displayName ? { displayName } : {})).then(persist),
  register: (input: { email: string; password: string; username: string; displayName?: string }) =>
    unwrap<AuthResult>(bare.post('/auth/register', input)).then(persist),
  login: (email: string, password: string) => unwrap<AuthResult>(bare.post('/auth/login', { email, password })).then(persist),
  google: (idToken: string) => unwrap<AuthResult>(bare.post('/auth/google', { idToken })).then(persist),
  apple: (identityToken: string, displayName?: string) => unwrap<AuthResult>(bare.post('/auth/apple', { identityToken, displayName })).then(persist),
  /** Guest -> registered; keeps all progress. The server revokes old sessions and returns fresh tokens. */
  upgradeGuest: (input: { email: string; password: string; username?: string }) => unwrap<AuthResult>(api.post('/auth/upgrade', input)).then(persist),
  async logout(): Promise<void> {
    const t = tokenStorage.current();
    if (t?.refreshToken) await bare.post('/auth/logout', { refreshToken: t.refreshToken }).catch(() => undefined); // best effort
    await tokenStorage.clear();
  },
  async logoutAll(): Promise<void> {
    await unwrap(api.post('/auth/logout-all')).catch(() => undefined);
    await tokenStorage.clear();
  },
  forgotPassword: (email: string) => unwrap<{ message: string }>(bare.post('/auth/forgot-password', { email })),
  resetPassword: (input: { email: string; code: string; newPassword: string }) => unwrap<{ message: string }>(bare.post('/auth/reset-password', input)),
  verifyEmail: (email: string, code: string) => unwrap<{ verified: true }>(bare.post('/auth/verify-email', { email, code })),
  resendVerification: () => unwrap<{ sent: true; retryAfterSec: number }>(api.post('/auth/resend-verification')),
  changePassword: (currentPassword: string, newPassword: string) => unwrap<{ message: string }>(api.post('/auth/change-password', { currentPassword, newPassword })),
};
