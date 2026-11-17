import { z } from 'zod';
import * as auth from '../services/auth.service.js';
import type { Ctx } from '../routes/registry.js';
import * as v from '../validators/auth.validator.js';

type B<T extends z.ZodType> = Ctx<z.infer<T>>;

export const register = (c: B<typeof v.registerBody>) => auth.register(c.body, c.session);
export const login = (c: B<typeof v.loginBody>) => auth.login(c.body, c.session);
export const guest = (c: B<typeof v.guestBody>) => auth.guestLogin(c.body, c.session);
export const refresh = (c: B<typeof v.refreshBody>) => auth.refresh(c.body.refreshToken, c.session);
export const upgrade = (c: B<typeof v.upgradeBody>) => auth.upgradeGuest(c.userId, c.body, c.session);
export const google = (c: B<typeof v.googleBody>) => auth.socialLogin('google', c.body.idToken, c.session, c.body);
export const apple = (c: B<typeof v.appleBody>) => auth.socialLogin('apple', c.body.identityToken, c.session, c.body);

export async function logout(c: B<typeof v.logoutBody>) {
  await auth.logout(c.body.refreshToken);
  return { loggedOut: true };
}
export async function logoutAll(c: Ctx) {
  await auth.logoutAll(c.userId, c.req.ip);
  return { loggedOut: true };
}
export async function forgotPassword(c: B<typeof v.forgotBody>) {
  await auth.forgotPassword(c.body.email);
  return { message: 'If an account exists for that email, a reset link has been sent.' };
}
export async function resetPassword(c: B<typeof v.resetBody>) {
  await auth.resetPassword(c.body);
  return { message: 'Password updated. Please log in again.' };
}
export async function verifyEmail(c: B<typeof v.verifyEmailBody>) {
  await auth.verifyEmail(c.body);
  return { verified: true };
}
export const resendVerification = (c: Ctx) => auth.resendVerification(c.userId);
export async function changePassword(c: B<typeof v.changePasswordBody>) {
  await auth.changePassword(c.userId, c.body.currentPassword, c.body.newPassword);
  return { message: 'Password changed. Please log in again on other devices.' };
}
