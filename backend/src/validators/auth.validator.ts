import { z } from 'zod';
import { deviceName, displayName, email, password, username } from './common.js';

export const registerBody = z.object({
  email,
  password,
  username,
  displayName: displayName.optional(),
  deviceName,
});

export const loginBody = z.object({ email, password: z.string().min(1).max(128), deviceName });
export const guestBody = z.object({ displayName: displayName.optional(), deviceName });
export const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) });
export const logoutBody = z.object({ refreshToken: z.string().min(20).max(200) });
export const forgotBody = z.object({ email });
const otpCode = z.string().regex(/^\d{6}$/, 'Code must be 6 digits');
export const resetBody = z.union([
  z.object({ token: z.string().min(20).max(200), newPassword: password }),
  z.object({ email, code: otpCode, newPassword: password }),
]);
export const verifyEmailBody = z.union([z.object({ token: z.string().min(20).max(200) }), z.object({ email, code: otpCode })]);
export const upgradeBody = z.object({ email, password, username: username.optional(), displayName: displayName.optional(), deviceName });
export const googleBody = z.object({ idToken: z.string().min(20).max(4096), displayName: displayName.optional(), deviceName });
export const appleBody = z.object({ identityToken: z.string().min(20).max(4096), displayName: displayName.optional(), deviceName });
export const changePasswordBody = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });

export type RegisterBody = z.infer<typeof registerBody>;
export type LoginBody = z.infer<typeof loginBody>;
