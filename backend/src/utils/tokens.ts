import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Errors } from './errors.js';

export interface AccessClaims {
  sub: string; // user id
  sid: string; // session (refresh token family) id
  act: 'GUEST' | 'REGISTERED';
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign({ sid: claims.sid, act: claims.act, typ: 'access' }, env.JWT_ACCESS_SECRET, {
    subject: claims.sub,
    expiresIn: env.ACCESS_TOKEN_TTL_SEC,
    algorithm: 'HS256',
    issuer: 'tictactoe-api',
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: 'tictactoe-api' }) as jwt.JwtPayload;
    if (p.typ !== 'access' || !p.sub || typeof p.sid !== 'string') throw Errors.unauthorized('Invalid token', 'INVALID_TOKEN');
    return { sub: p.sub, sid: p.sid, act: p.act === 'REGISTERED' ? 'REGISTERED' : 'GUEST' };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw Errors.unauthorized('Access token expired', 'TOKEN_EXPIRED');
    if (err instanceof Error && err.name === 'AppError') throw err;
    throw Errors.unauthorized('Invalid token', 'INVALID_TOKEN');
  }
}
