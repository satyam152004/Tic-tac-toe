import { z } from 'zod';
import type { Ctx } from '../routes/registry.js';
import * as ach from '../services/achievement.service.js';
import * as friends from '../services/friend.service.js';
import * as lb from '../services/leaderboard.service.js';
import * as notif from '../services/notification.service.js';
import * as stats from '../services/stats.service.js';
import { paginationQuery } from '../utils/pagination.js';
import { idParam } from '../validators/common.js';
import * as gv from '../validators/game.validator.js';
import * as sv from '../validators/social.validator.js';

type P = z.infer<typeof idParam>;

// friends
export const friendList = (c: Ctx<unknown, z.infer<typeof sv.friendListQuery>>) => friends.list(c.userId, c.query);
export const friendRequest = (c: Ctx<z.infer<typeof sv.friendRequestBody>>) => friends.sendRequest(c.userId, c.body);
export const friendAccept = (c: Ctx<unknown, unknown, P>) => friends.accept(c.userId, c.params.id);
export async function friendReject(c: Ctx<unknown, unknown, P>) {
  await friends.reject(c.userId, c.params.id);
  return { rejected: true };
}
export async function friendRemove(c: Ctx<unknown, unknown, P>) {
  await friends.remove(c.userId, c.params.id);
  return { removed: true };
}
export const friendBlock = (c: Ctx<unknown, unknown, P>) => friends.block(c.userId, c.params.id);
export const friendUnblock = (c: Ctx<unknown, unknown, P>) => friends.unblock(c.userId, c.params.id);
export const blockedList = (c: Ctx<unknown, z.infer<typeof paginationQuery>>) => friends.listBlocked(c.userId, c.query);

// leaderboards
type LQ = Ctx<unknown, z.infer<typeof gv.leaderboardQuery>>;
export const lbGlobal = (c: LQ) => lb.globalBoard(c.userId, c.query);
export const lbDaily = (c: LQ) => lb.periodBoard(c.userId, 'daily', c.query);
export const lbWeekly = (c: LQ) => lb.periodBoard(c.userId, 'weekly', c.query);
export const lbMonthly = (c: LQ) => lb.periodBoard(c.userId, 'monthly', c.query);
export const lbFriends = (c: LQ) => lb.friendsBoard(c.userId, c.query);

// statistics + achievements
export const myStats = (c: Ctx) => stats.myStats(c.userId);
export const myHistory = (c: Ctx<unknown, z.infer<typeof gv.historyQuery>>) => stats.myHistory(c.userId, c.query);
export const myStreaks = (c: Ctx) => stats.myStreaks(c.userId);
export const syncLocal = (c: Ctx<z.infer<typeof gv.localMatchesBody>>) => stats.syncLocalMatches(c.userId, c.body.matches);
export const achievementList = () => ach.listAchievements();
export const achievementMine = (c: Ctx) => ach.myAchievements(c.userId);

// notifications
export const notifList = (c: Ctx<unknown, z.infer<typeof sv.notificationsQuery>>) => notif.listNotifications(c.userId, c.query);
export const notifRead = (c: Ctx<unknown, unknown, P>) => notif.markRead(c.userId, c.params.id);
export const notifReadAll = (c: Ctx) => notif.markAllRead(c.userId);
export async function notifDelete(c: Ctx<unknown, unknown, P>) {
  await notif.deleteNotification(c.userId, c.params.id);
  return { deleted: true };
}
