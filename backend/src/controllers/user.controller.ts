import { z } from 'zod';
import type { Ctx } from '../routes/registry.js';
import * as users from '../services/user.service.js';
import { idParam } from '../validators/common.js';
import * as v from '../validators/user.validator.js';

type P = z.infer<typeof idParam>;

export const getMe = (c: Ctx) => users.getMe(c.userId);
export const updateMe = (c: Ctx<z.infer<typeof v.updateMeBody>>) => users.updateMe(c.userId, c.body);
export async function deleteMe(c: Ctx<z.infer<typeof v.deleteMeBody>>) {
  await users.deleteAccount(c.userId, c.body.password, c.req.ip);
  return { deleted: true };
}
export const getUser = (c: Ctx<unknown, unknown, P>) => users.getPublicProfile(c.userId, c.params.id);
export const search = (c: Ctx<unknown, z.infer<typeof v.searchQuery>>) => users.searchUsers(c.userId, c.query);
export const report = (c: Ctx<z.infer<typeof v.reportBody>, unknown, P>) => users.reportUser(c.userId, c.params.id, c.body);
export const registerDevice = (c: Ctx<z.infer<typeof v.registerDeviceBody>>) => users.registerDevice(c.userId, c.body);
export async function removeDevice(c: Ctx<unknown, unknown, P>) {
  await users.removeDevice(c.userId, c.params.id);
  return { removed: true };
}
