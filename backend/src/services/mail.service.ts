import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import nodemailer, { Transporter } from 'nodemailer';
import { env, isProd, isTest } from '../config/env.js';
import { logger } from '../config/logger.js';

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
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (isTest) {
    testOutbox.push(mail);
    return;
  }
  const t = getTransporter();
  if (!t) {
    // Mail bodies hold one-time codes/tokens, so they are NEVER written to the log. In development they go to
    // .dev-mail/ (git-ignored) so a developer can read the code; in production the mail is dropped (configure SMTP).
    if (!isProd) {
      try {
        const dir = join(process.cwd(), '.dev-mail');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, `${Date.now()}-${mail.to.replace(/[^a-z0-9@.]/gi, '_')}.txt`), `To: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`);
      } catch {
        /* best effort */
      }
      logger.warn({ subject: mail.subject }, 'SMTP not configured; email written to .dev-mail/');
    } else logger.error({ subject: mail.subject }, 'SMTP not configured; email dropped');
    return;
  }
  try {
    await t.sendMail({ from: env.MAIL_FROM, ...mail });
  } catch (err) {
    logger.error({ err: (err as Error).message, subject: mail.subject }, 'Failed to send email');
  }
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
  passwordChanged: (to: string): Mail => ({
    to,
    subject: 'Your password was changed',
    text: 'Your password was just changed and all devices were signed out. If this was not you, reset your password immediately.',
  }),
};
