import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { Errors } from '../utils/errors.js';

export interface SocialIdentity {
  subject: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

const asBool = (v: unknown) => v === true || v === 'true';

/** Verifiers live on a mutable object so tests can substitute them without network access. */
export const socialVerifiers = {
  async google(idToken: string): Promise<SocialIdentity> {
    const audiences = env.GOOGLE_CLIENT_IDS.split(',').map((s) => s.trim()).filter(Boolean);
    if (!audiences.length) throw new (await import('../utils/errors.js')).AppError(503, 'PROVIDER_NOT_CONFIGURED', 'Google sign-in is not available right now.');
    try {
      const { payload } = await jwtVerify(idToken, googleJwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: audiences,
      });
      if (!payload.sub) throw new Error('missing sub');
      return {
        subject: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        emailVerified: asBool(payload.email_verified),
        name: typeof payload.name === 'string' ? payload.name : undefined,
      };
    } catch {
      throw Errors.unauthorized('Couldn\'t sign in with Google. Try again.', 'INVALID_SOCIAL_TOKEN');
    }
  },
  async apple(identityToken: string): Promise<SocialIdentity> {
    if (!env.APPLE_CLIENT_ID) throw new (await import('../utils/errors.js')).AppError(503, 'PROVIDER_NOT_CONFIGURED', 'Apple sign-in is not available right now.');
    try {
      const { payload } = await jwtVerify(identityToken, appleJwks, {
        issuer: 'https://appleid.apple.com',
        audience: env.APPLE_CLIENT_ID,
      });
      if (!payload.sub) throw new Error('missing sub');
      return {
        subject: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        emailVerified: asBool(payload.email_verified),
      };
    } catch {
      throw Errors.unauthorized('Couldn\'t sign in with Apple. Try again.', 'INVALID_SOCIAL_TOKEN');
    }
  },
};
