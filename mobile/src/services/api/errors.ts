import axios from 'axios';

/** Normalised error thrown by every API/socket helper. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (axios.isAxiosError(e)) {
    const body = e.response?.data as { error?: { code?: string; message?: string; details?: unknown } } | undefined;
    if (body?.error?.code) return new ApiError(body.error.code, body.error.message ?? 'Something went wrong. Try again.', e.response?.status, body.error.details);
    if (axios.isCancel(e)) return new ApiError('CANCELLED', 'Request cancelled');
    if (e.code === 'ECONNABORTED' || e.message === 'Network Error' || !e.response) return new ApiError('NETWORK_ERROR', "Can't connect. Check your internet.");
    return new ApiError(`HTTP_${e.response.status}`, e.message, e.response.status);
  }
  const s = e as { code?: string; message?: string; details?: unknown };
  if (s && typeof s === 'object' && typeof s.code === 'string') return new ApiError(s.code, s.message ?? 'Something went wrong. Try again.', undefined, s.details);
  return new ApiError('UNKNOWN', e instanceof Error ? e.message : 'Something went wrong. Try again.');
}

const FRIENDLY: Record<string, string> = {
  NETWORK_ERROR: "You're offline. Check your internet.",
  INVALID_CREDENTIALS: 'Wrong email or password.',
  EMAIL_TAKEN: 'That email is already in use.',
  USERNAME_TAKEN: 'That username is taken.',
  INVALID_OTP: 'That code is wrong or expired.',
  OTP_LOCKED: 'Too many wrong tries. Ask for a new code.',
  OTP_COOLDOWN: 'Wait a moment, then ask for a new code.',
  OTP_RATE_LIMITED: 'Too many codes asked for. Try again later.',
  NOT_YOUR_TURN: "It's not your turn.",
  CELL_OCCUPIED: 'That square is already taken.',
  MOVE_CONFLICT: 'The board changed. Take another look.',
  GAME_NOT_ACTIVE: 'This game is over.',
  ALREADY_IN_GAME: "You're already in a game.",
  ROOM_NOT_FOUND: "We can't find that room code.",
  ROOM_FULL: 'That room is full.',
  ROOM_EXPIRED: 'That room has closed.',
  RATE_LIMITED: 'Slow down and try again in a moment.',
  REWARD_ALREADY_CLAIMED: "You've already claimed today's reward.",
  TIMEZONE_CHANGE_LIMITED: 'You can change your time zone once every 7 days.',
};
export const friendlyMessage = (e: unknown): string => {
  const err = toApiError(e);
  return FRIENDLY[err.code] ?? err.message;
};

export const SESSION_DEAD_CODES = new Set(['INVALID_REFRESH_TOKEN', 'REFRESH_TOKEN_EXPIRED', 'REFRESH_TOKEN_REUSED']);
