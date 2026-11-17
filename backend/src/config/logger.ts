import pino from 'pino';
import { env, isProd, isTest } from './env.js';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      '*.password',
      '*.newPassword',
      '*.refreshToken',
      '*.accessToken',
      '*.idToken',
      '*.token',
      '*.passwordHash',
    ],
    censor: '[REDACTED]',
  },
  ...(isProd || isTest ? {} : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
});

/** Audit trail for sensitive actions (also persisted by services/audit.service). */
export const auditLogger = logger.child({ channel: 'audit' });
