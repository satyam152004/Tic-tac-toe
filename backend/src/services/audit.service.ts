import { auditLogger } from '../config/logger.js';
import { AuditLogModel } from '../models/index.js';
import { addMs } from '../utils/time.js';

const RETENTION_MS = 180 * 24 * 3600 * 1000;

/** Audit trail for sensitive actions. Never pass secrets in `meta`. Failures never break the request. */
export function audit(action: string, opts: { userId?: unknown; ip?: string; meta?: Record<string, unknown> } = {}): void {
  auditLogger.info({ action, userId: opts.userId ? String(opts.userId) : undefined, ip: opts.ip, meta: opts.meta }, 'audit');
  AuditLogModel.create({
    action,
    userId: opts.userId,
    ip: opts.ip,
    meta: opts.meta,
    expireAt: addMs(new Date(), RETENTION_MS),
  }).catch((err: Error) => auditLogger.error({ err: err.message }, 'audit persist failed'));
}
