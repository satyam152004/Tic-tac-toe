import { toApiError } from '../../services/api/errors';

/** Mirrors backend/src/validators/common.ts (password, username, email). */
export const PASSWORD_RULES = [
  { id: 'len', label: '8+ chars', test: (v: string) => v.length >= 8 },
  { id: 'digit', label: '1 number', test: (v: string) => /\d/.test(v) },
  { id: 'letter', label: '1 letter', test: (v: string) => /[A-Za-z]/.test(v) },
] as const;

export const passwordValid = (v: string): boolean => v.length <= 128 && PASSWORD_RULES.every((r) => r.test(v));
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const emailError = (v: string): string | null => {
  const t = v.trim();
  if (!t) return 'Enter your email';
  return EMAIL_RE.test(t) && t.length <= 254 ? null : 'Enter a valid email';
};
export const usernameError = (v: string): string | null => {
  const t = v.trim();
  if (t.length < 3) return 'Use at least 3 characters';
  if (t.length > 20) return 'Use 20 characters or fewer';
  if (!/^[A-Za-z0-9_]+$/.test(t)) return 'Only letters, numbers and underscores';
  return null;
};

export const OTP_LENGTH = 6;
export const OTP_COOLDOWN_SEC = 60;

/** Extra info the backend attaches to OTP errors. */
export function otpErrorInfo(e: unknown): { code: string; attemptsLeft?: number; retryAfterSec?: number } {
  const err = toApiError(e);
  const d = (err.details ?? {}) as { attemptsLeft?: unknown; retryAfterSec?: unknown };
  return {
    code: err.code,
    attemptsLeft: typeof d.attemptsLeft === 'number' ? d.attemptsLeft : undefined,
    retryAfterSec: typeof d.retryAfterSec === 'number' ? d.retryAfterSec : undefined,
  };
}
