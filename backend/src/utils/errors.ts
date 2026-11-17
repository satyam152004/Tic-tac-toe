export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  badRequest: (message = 'Bad request', code = 'BAD_REQUEST', details?: unknown) => new AppError(400, code, message, details),
  validation: (details: unknown, message = 'Validation failed') => new AppError(400, 'VALIDATION_ERROR', message, details),
  unauthorized: (message = 'Authentication required', code = 'UNAUTHORIZED') => new AppError(401, code, message),
  forbidden: (message = 'Forbidden', code = 'FORBIDDEN') => new AppError(403, code, message),
  notFound: (message = 'Resource not found', code = 'NOT_FOUND') => new AppError(404, code, message),
  conflict: (message = 'Conflict', code = 'CONFLICT', details?: unknown) => new AppError(409, code, message, details),
  tooMany: (message = 'Too many requests', code = 'RATE_LIMITED') => new AppError(429, code, message),
  internal: (message = 'Internal server error') => new AppError(500, 'INTERNAL_ERROR', message),
};

/** Error codes documented in the API (used by generated docs). */
export const COMMON_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'INVALID_TOKEN',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;
