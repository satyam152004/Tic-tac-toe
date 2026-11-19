import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  // Render (RENDER=true) always terminates TLS in a proxy: without this every client shares the proxy's IP and the rate limits.
  TRUST_PROXY: bool.default(process.env.RENDER === 'true'),
  LOG_LEVEL: z.string().default('info'),

  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/tictactoe'),
  REDIS_URL: z.string().default(''),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  GUEST_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(90),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  GOOGLE_CLIENT_IDS: z.string().default(''),
  APPLE_CLIENT_ID: z.string().default(''),

  // Email configuration
  BREVO_API_KEY: z.string().default(''),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('Tic Tac Toe <no-reply@example.com>'),
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  /** Upper bound for one email delivery attempt (Brevo API call or SMTP session). */
  MAIL_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(10_000),

  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().default(''),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().default(''),

  RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  SOCKET_EVENTS_PER_SEC: z.coerce.number().int().positive().default(20),
  TURN_TIMEOUT_SEC: z.coerce.number().int().positive().default(60),
  DISCONNECT_GRACE_SEC: z.coerce.number().int().positive().default(30),
  MATCH_QUEUE_TTL_SEC: z.coerce.number().int().positive().default(120),
  ROOM_TTL_MIN: z.coerce.number().int().positive().default(30),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    'Invalid environment configuration:\n' + z.prettifyError(parsed.error),
  );
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const corsOrigins = env.CORS_ORIGINS
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (isProd) {
  if (corsOrigins.includes('*')) {
    console.error('CORS_ORIGINS must not contain "*" in production');
    process.exit(1);
  }

  if (/change-me/i.test(env.JWT_ACCESS_SECRET)) {
    console.error('JWT_ACCESS_SECRET must be changed in production');
    process.exit(1);
  }

  // The localhost default is only meant for development; in production it would retry forever against nothing.
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI must be set in production');
    process.exit(1);
  }

  // Warnings only (never fatal, so an existing deployment keeps starting): these are almost always misconfiguration.
  if (!env.BREVO_API_KEY && !env.SMTP_HOST) console.warn('No email provider configured (BREVO_API_KEY / SMTP_HOST): verification and password-reset emails will fail');
  if (!env.TRUST_PROXY) console.warn('TRUST_PROXY is false in production: behind a load balancer all clients will share one rate-limit bucket');
  if (/localhost|127\.0\.0\.1/.test(env.APP_BASE_URL)) console.warn('APP_BASE_URL points at localhost: emailed links will not work');
}
