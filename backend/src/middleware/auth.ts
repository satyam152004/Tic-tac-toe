import { NextFunction, Request, Response } from 'express';
import { Errors } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/tokens.js';

/** Verifies the Bearer access token and attaches `req.auth`. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) throw Errors.unauthorized('Sign in first.');
    const claims = verifyAccessToken(header.slice(7).trim());
    req.auth = { userId: claims.sub, sessionId: claims.sid, accountType: claims.act };
    next();
  } catch (err) {
    next(err);
  }
}

/** Blocks guest accounts from features that require a registered account. */
export function requireRegistered(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.accountType !== 'REGISTERED') {
    next(Errors.forbidden('Create an account to do this.', 'REGISTERED_ACCOUNT_REQUIRED'));
    return;
  }
  next();
}
