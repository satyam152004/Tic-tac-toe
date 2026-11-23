import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import nodemailer, { Transporter } from 'nodemailer';
import { env, isProd, isTest } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Test-only outbox so integration tests can read verification / reset tokens. */
export const testOutbox: Mail[] = [];

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;

  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
    // Never let a stalled SMTP server hang a request: fail fast and let the caller decide.
    connectionTimeout: env.MAIL_TIMEOUT_MS,
    greetingTimeout: env.MAIL_TIMEOUT_MS,
    socketTimeout: env.MAIL_TIMEOUT_MS,
  });

  return transporter;
}

function getSenderEmail(): string {
  const from = env.MAIL_FROM;
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

/** Thrown when an email could not be handed to the provider (timeout, provider error, not configured). */
export class MailDeliveryError extends AppError {
  constructor(message = 'Email could not be sent right now, please try again shortly') {
    super(503, 'EMAIL_DELIVERY_FAILED', message);
    this.name = 'MailDeliveryError';
  }
}

export async function sendMail(mail: Mail): Promise<void> {
  if (isTest) {
    testOutbox.push(mail);
    return;
  }

  // Prefer Brevo API when configured.
  const brevoApiKey = env.BREVO_API_KEY;

  if (brevoApiKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        // Bounded: a hung Brevo call must not hold a registration / password-reset request open.
        signal: AbortSignal.timeout(env.MAIL_TIMEOUT_MS),
        body: JSON.stringify({
          sender: {
            email: getSenderEmail(),
            name: 'Tic Tac Toe',
          },
          to: [{ email: mail.to }],
          subject: mail.subject,
          textContent: mail.text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, error: errorText.slice(0, 300), subject: mail.subject },
          'Brevo email delivery failed',
        );
        throw new Error(`Brevo API returned status ${response.status}`);
      }

      logger.info({ subject: mail.subject }, 'Email accepted by Brevo');
      return;
    } catch (err) {
      const timedOut = (err as Error).name === 'TimeoutError' || (err as Error).name === 'AbortError';
      logger.error(
        { err: (err as Error).message, timedOut, subject: mail.subject },
        'Failed to send email through Brevo',
      );
      throw new MailDeliveryError();
    }
  }

  // SMTP fallback if Brevo is not configured.
  const t = getTransporter();

  if (t) {
    try {
      await t.sendMail({ from: env.MAIL_FROM, ...mail });
      return;
    } catch (err) {
      logger.error(
        { err: (err as Error).message, subject: mail.subject },
        'Failed to send email through SMTP',
      );
      throw new MailDeliveryError();
    }
  }

  if (!isProd) {
    try {
      const dir = join(process.cwd(), '.dev-mail');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, `${Date.now()}-${mail.to.replace(/[^a-z0-9@.]/gi, '_')}.txt`),
        `To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`,
      );
    } catch {
      /* best effort */
    }

    logger.warn({ subject: mail.subject }, 'Email written to .dev-mail/');
    return;
  }

  logger.error({ subject: mail.subject }, 'No email provider configured');
  throw new MailDeliveryError();
}

export const mailTemplates = {
  verifyEmail: (to: string, token: string, code: string): Mail => ({
    to,
    subject: `${code} is your Tic Tac Toe verification code`,
    text: `Welcome to Tic Tac Toe!\n\nYour verification code: Code: ${code}\nIt expires in 10 minutes.\n\nOr verify with the link: ${env.APP_BASE_URL}/verify-email?token=${token}\n\nToken: ${token}\n\nThe link expires in 24 hours.`,
  }),

  resendVerifyEmail: (to: string, code: string): Mail => ({
    to,
    subject: `${code} is your Tic Tac Toe verification code`,
    text: `Your verification code: Code: ${code}\nIt expires in 10 minutes. If you did not ask for it, ignore this email.`,
  }),

  resetPassword: (to: string, token: string, code: string): Mail => ({
    to,
    subject: `${code} is your Tic Tac Toe password reset code`,
    text: `Your password reset code: Code: ${code}\nIt expires in 10 minutes.\n\nOr reset with the link: ${env.APP_BASE_URL}/reset-password?token=${token}\n\nToken: ${token}\n\nThe link expires in 1 hour. If you did not request this, ignore this email.`,
  }),

  setPassword: (to: string, code: string): Mail => ({
    to,
    subject: `${code} is your Tic Tac Toe code to set a password`,
    text: `Your code to add a password to your account: ${code}\nIt expires in 10 minutes.\n\nYou will still be able to sign in with Google or Apple. If you did not request this, ignore this email.`,
  }),

  passwordChanged: (to: string): Mail => ({
    to,
    subject: 'Your password was changed',
    text: 'Your password was just changed and all devices were signed out. If this was not you, reset your password immediately.',
  }),
};
