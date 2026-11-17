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

/** Turns anything thrown by axios / sockets into an ApiError with a stable `code`. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (axios.isAxiosError(e)) {
    const body = e.response?.data as { error?: { code?: string; message?: string; details?: unknown } } | undefined;
    if (body?.error?.code) return new ApiError(body.error.code, body.error.message ?? 'Request failed', e.response?.status, body.error.details);
    if (e.code === 'ECONNABORTED' || e.message === 'Network Error' || !e.response) return new ApiError('NETWORK_ERROR', 'Cannot reach the server. Check your connection.');
    return new ApiError('HTTP_' + e.response.status, e.message, e.response.status);
  }
  const s = e as { code?: string; message?: string; details?: unknown };
  if (s && typeof s === 'object' && typeof s.code === 'string') return new ApiError(s.code, s.message ?? 'Error', undefined, s.details);
  return new ApiError('UNKNOWN', e instanceof Error ? e.message : 'Unknown error');
}

/** User facing text for the error codes the UI must handle. Fall back to `error.message` for the rest. */
const FRIENDLY: Record<string, string> = {
  NETWORK_ERROR: 'You appear to be offline.',
  INVALID_CREDENTIALS: 'Wrong email or password.',
  EMAIL_TAKEN: 'That email is already registered.',
  USERNAME_TAKEN: 'That username is taken.',
  NOT_YOUR_TURN: "It's not your turn.",
  CELL_OCCUPIED: 'That square is already taken.',
  MOVE_CONFLICT: 'The board changed, please look again.',
  GAME_NOT_ACTIVE: 'This game has ended.',
  ALREADY_IN_GAME: 'You are already in a game.',
  ROOM_NOT_FOUND: 'Room code not found.',
  ROOM_FULL: 'That room is full.',
  ROOM_EXPIRED: 'That room has expired.',
  RATE_LIMITED: 'Slow down a little and try again.',
};
export const friendlyMessage = (e: ApiError): string => FRIENDLY[e.code] ?? e.message;

/** Codes that mean "the session is over: send the user to the login screen". */
export const SESSION_DEAD_CODES = new Set(['INVALID_REFRESH_TOKEN', 'REFRESH_TOKEN_EXPIRED', 'REFRESH_TOKEN_REUSED']);
