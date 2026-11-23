import * as room from '../controllers/room.controller.js';
import * as s from '../controllers/social.controller.js';
import { paginationQuery } from '../utils/pagination.js';
import { idParam } from '../validators/common.js';
import * as gv from '../validators/game.validator.js';
import * as sv from '../validators/social.validator.js';
import { route } from './registry.js';

const roomErrors = ['ROOM_NOT_FOUND', 'NOT_IN_ROOM'];

export const roomRoutes = [
  route({ method: 'post', path: '/rooms', tag: 'Rooms', summary: 'Create a room (host). Private by default; isPublic lists it in /rooms/open', body: sv.roomCreateBody, status: 201, response: 'Room { id, code, status, host, guest, ... }', errors: ['ALREADY_IN_ROOM', 'ALREADY_IN_GAME', 'INVALID_BOARD_CONFIG'], handler: room.create }),
  route({ method: 'post', path: '/rooms/join', tag: 'Rooms', summary: 'Join a room with its 6 character code', body: sv.roomJoinBody, response: 'Room', errors: ['ROOM_NOT_FOUND', 'ROOM_EXPIRED', 'ROOM_FULL', 'ALREADY_IN_ROOM', 'ALREADY_IN_GAME', 'BLOCKED'], handler: room.join }),
  route({ method: 'get', path: '/rooms/open', tag: 'Rooms', summary: 'Public open rooms: waiting for a guest, host opted in (own and blocked users excluded)', query: sv.roomOpenQuery, response: '{ items: [{ id, code, host, hostPoints, boardSize, winLength, turnTimeoutSec, expiresAt }] }', handler: room.listOpen }),
  route({ method: 'get', path: '/rooms/:id', tag: 'Rooms', summary: 'Get a room I am in (or was invited to)', params: idParam, response: 'Room', errors: roomErrors, handler: room.get }),
  route({ method: 'post', path: '/rooms/:id/leave', tag: 'Rooms', summary: 'Leave a room (host leaving promotes the guest; forfeits a running game)', params: idParam, response: 'Room (status EXPIRED when the last member left)', errors: roomErrors, handler: room.leave }),
  route({ method: 'post', path: '/rooms/:id/ready', tag: 'Rooms', summary: 'Guest sets readiness (host is always ready)', params: idParam, body: sv.roomReadyBody, response: 'Room', errors: [...roomErrors, 'HOST_ALWAYS_READY', 'ROOM_STATE'], handler: room.ready }),
  route({ method: 'post', path: '/rooms/:id/start', tag: 'Rooms', summary: 'Host starts the game (both players present and ready)', params: idParam, response: '{ room, game }', errors: [...roomErrors, 'NOT_HOST', 'ROOM_NOT_READY', 'ROOM_STATE'], handler: room.start }),
  route({ method: 'post', path: '/rooms/:id/invite', tag: 'Rooms', summary: 'Invite a friend to the room (notification with room code)', params: idParam, body: sv.roomInviteBody, response: '{ invited: true, roomCode }', errors: [...roomErrors, 'NOT_FRIENDS', 'BLOCKED', 'ROOM_FULL'], handler: room.invite }),
];

export const matchmakingRoutes = [
  route({ method: 'post', path: '/matchmaking/join', tag: 'Matchmaking', summary: 'Join the quick-match queue (returns the game immediately if an opponent was waiting)', body: sv.matchmakingJoinBody, response: '{ status: QUEUED | MATCHED, ticket, game? }', errors: ['ALREADY_IN_GAME', 'INVALID_BOARD_CONFIG'], handler: room.mmJoin }),
  route({ method: 'post', path: '/matchmaking/cancel', tag: 'Matchmaking', summary: 'Leave the matchmaking queue', response: '{ cancelled: boolean }', handler: room.mmCancel }),
  route({ method: 'get', path: '/matchmaking/status', tag: 'Matchmaking', summary: 'Current queue status and active online game', response: '{ queued, ticket, queuedForSec, activeGameId }', handler: room.mmStatus }),
];

export const friendRoutes = [
  route({ method: 'get', path: '/friends', tag: 'Friends', summary: 'List friends (status=accepted, with online status) or pending requests (incoming / outgoing)', query: sv.friendListQuery, response: 'Array of { friendshipId, status, user }', handler: s.friendList }),
  route({ method: 'get', path: '/friends/blocked', tag: 'Friends', summary: 'List players I blocked', query: paginationQuery, response: 'Array of player cards', handler: s.blockedList }),
  route({ method: 'post', path: '/friends/request', tag: 'Friends', summary: 'Send a friend request by userId or username', body: sv.friendRequestBody, status: 201, response: '{ id, status }', errors: ['USER_NOT_FOUND', 'SELF_REQUEST', 'ALREADY_FRIENDS', 'REQUEST_ALREADY_SENT', 'BLOCKED'], handler: s.friendRequest }),
  route({ method: 'post', path: '/friends/:id/accept', tag: 'Friends', summary: 'Accept an incoming friend request (:id = friendshipId)', params: idParam, response: '{ id, status: ACCEPTED, friendId }', errors: ['REQUEST_NOT_FOUND'], handler: s.friendAccept }),
  route({ method: 'post', path: '/friends/:id/reject', tag: 'Friends', summary: 'Reject an incoming friend request (:id = friendshipId)', params: idParam, response: '{ rejected: true }', errors: ['REQUEST_NOT_FOUND'], handler: s.friendReject }),
  route({ method: 'delete', path: '/friends/:id', tag: 'Friends', summary: 'Remove a friend, or cancel my outgoing request (:id = friendshipId)', params: idParam, response: '{ removed: true }', errors: ['FRIENDSHIP_NOT_FOUND'], handler: s.friendRemove }),
  route({ method: 'post', path: '/friends/:id/block', tag: 'Friends', summary: 'Block a player (:id = userId); removes any friendship', params: idParam, response: '{ blocked: true }', errors: ['SELF_BLOCK', 'USER_NOT_FOUND'], handler: s.friendBlock }),
  route({ method: 'post', path: '/friends/:id/unblock', tag: 'Friends', summary: 'Unblock a player (:id = userId)', params: idParam, response: '{ blocked: false }', errors: ['NOT_BLOCKED'], handler: s.friendUnblock }),
];

export const leaderboardRoutes = [
  route({ method: 'get', path: '/leaderboard/global', tag: 'Leaderboard', summary: 'All-time leaderboard (metric=points|wins) with my rank in meta.me', query: gv.leaderboardQuery, response: 'Array of { rank, user, points, wins, games }', handler: s.lbGlobal }),
  route({ method: 'get', path: '/leaderboard/daily', tag: 'Leaderboard', summary: 'Today (UTC) leaderboard', query: gv.leaderboardQuery, response: 'Array of { rank, user, points, wins, games }', handler: s.lbDaily }),
  route({ method: 'get', path: '/leaderboard/weekly', tag: 'Leaderboard', summary: 'This ISO week (UTC) leaderboard', query: gv.leaderboardQuery, response: 'Array of { rank, user, points, wins, games }', handler: s.lbWeekly }),
  route({ method: 'get', path: '/leaderboard/monthly', tag: 'Leaderboard', summary: 'This month (UTC) leaderboard', query: gv.leaderboardQuery, response: 'Array of { rank, user, points, wins, games }', handler: s.lbMonthly }),
  route({ method: 'get', path: '/leaderboard/friends', tag: 'Leaderboard', summary: 'Leaderboard of me and my friends', query: gv.leaderboardQuery, response: 'Array of { rank, user, points, wins, games, isMe }', handler: s.lbFriends }),
];

export const statsRoutes = [
  route({ method: 'get', path: '/statistics/me', tag: 'Statistics', summary: 'My statistics', response: 'Totals, win %, avg duration, play time, streaks, AI/online/local breakdown', handler: s.myStats }),
  route({ method: 'get', path: '/statistics/me/history', tag: 'Statistics', summary: 'My finished games (filter by type/result)', query: gv.historyQuery, response: 'Array of game summaries (paginated)', handler: s.myHistory }),
  route({ method: 'get', path: '/statistics/me/streaks', tag: 'Statistics', summary: 'Current/best winning streak and recent form', response: '{ currentStreak, bestStreak, recentForm[] }', handler: s.myStreaks }),
  route({ method: 'post', path: '/statistics/me/local-matches', tag: 'Statistics', summary: 'Sync offline matches; each is verified by replaying its moves on the server (idempotent per clientMatchId)', body: gv.localMatchesBody, response: '{ accepted, duplicates, rejected[] }', handler: s.syncLocal }),
  route({ method: 'get', path: '/achievements', tag: 'Achievements', summary: 'Achievement catalogue', response: 'Array of definitions', handler: s.achievementList }),
  route({ method: 'get', path: '/achievements/me', tag: 'Achievements', summary: 'My achievement progress and unlock history', response: '{ items[], unlockedCount, total, history[] }', handler: s.achievementMine }),
];

export const notificationRoutes = [
  route({ method: 'get', path: '/notifications', tag: 'Notifications', summary: 'Notification history (meta.unread = unread count)', query: sv.notificationsQuery, response: 'Array of notifications', handler: s.notifList }),
  route({ method: 'patch', path: '/notifications/read-all', tag: 'Notifications', summary: 'Mark all notifications as read', response: '{ updated }', handler: s.notifReadAll }),
  route({ method: 'patch', path: '/notifications/:id/read', tag: 'Notifications', summary: 'Mark one notification as read', params: idParam, response: 'Notification', errors: ['NOT_FOUND'], handler: s.notifRead }),
  route({ method: 'delete', path: '/notifications/:id', tag: 'Notifications', summary: 'Delete a notification', params: idParam, response: '{ deleted: true }', errors: ['NOT_FOUND'], handler: s.notifDelete }),
];
