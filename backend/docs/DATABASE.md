# Database design (MongoDB / Mongoose)

All 14 required collections exist as Mongoose models in `src/models` (plus `auditlogs`). Indexes are declared on the
schemas and built on startup (`syncIndexes()`); `tests/integration/database.test.ts` asserts the key indexes, TTLs and unique constraints.

| Collection (model) | Purpose | Key fields | Indexes / constraints |
|---|---|---|---|
| `users` (User) | Accounts + profile + **all verified statistics** | `username`, `usernameLower`, `displayName`, `email`, `passwordHash` (select:false), `accountType` GUEST/REGISTERED, `providers[]`, `avatar`, `theme`, `sound{}`, `language`, `notificationPrefs{}`, `stats{}` (games/wins/losses/draws/points/xp/level/streaks/play time/ai/online/local counters), `online`, `lastActiveAt`, `deletedAt`, hashed verify/reset tokens | **unique** `usernameLower`; **unique partial** `email` (only real emails, so guests never collide); **unique partial** `providers.provider+subject`; `stats.points desc, _id`; `stats.wins desc, _id`; `online+lastActiveAt` |
| `refreshtokens` (RefreshToken) | Hashed refresh tokens, grouped in session *families* | `userId`, `familyId`, `tokenHash` (SHA-256), `expiresAt`, `revokedAt`, `replacedByHash`, `ip`, `userAgent`, `deviceName` | **unique** `tokenHash`; `userId`; `familyId`; **TTL** `expiresAt` |
| `games` (Game) | Authoritative game state + result | `type`, `status`, `boardSize`, `winLength`, `board[]`, `currentTurn`, `moveCount` (= version), `players[{userId,mark,isAI,joinedAt,outcome,pointsAwarded}]`, `playerIds[]`, `difficulty`, `roomId`, `turnDeadline`, `result{winner,winnerId,line,reason}`, `disconnectedAt{X,O}`, `finalizedAt`, `rematch*`, `clientMatchId`, `purgeAt` | `status+turnDeadline`; `playerIds+status+createdAt`; `playerIds+endedAt`; `roomId`; `status+disconnectedAt.X/O`; **unique partial** `createdBy+clientMatchId`; **TTL** `purgeAt` |
| `moves` (Move) | Move log (one document per accepted move) | `gameId`, `moveNumber`, `playerId` (null = AI), `mark`, `position`, `clientMoveId`, `expireAt` | **unique** `gameId+moveNumber`; **unique** `gameId+position`; **unique partial** `gameId+playerId+clientMoveId` (idempotency); **TTL** `expireAt` |
| `rooms` (Room) | Private rooms | `code` (6 chars), `hostId`, `guestId`, `status`, `boardSize`, `winLength`, `guestReady`, `invitedUserIds[]`, `gameId`, `expiresAt`, `purgeAt` | **unique** `code`; `hostId+status`; `guestId+status`; `status+expiresAt`; **TTL** `purgeAt` |
| `matchmakingtickets` (MatchmakingTicket) | Quick-match queue | `userId`, `boardSize`, `winLength`, `status` QUEUED/MATCHED/CANCELLED/EXPIRED, `gameId`, `queueExpiresAt`, `purgeAt` | **unique partial** `userId` where `status=QUEUED` (one queue entry per user, cluster-wide); `status+boardSize+winLength+createdAt`; `status+queueExpiresAt`; **TTL** `purgeAt` |
| `friendships` (Friendship) | Friend requests + friendships | `requesterId`, `recipientId`, `pairKey` (sorted ids), `status` PENDING/ACCEPTED | **unique** `pairKey` (no duplicates in either direction); `recipientId+status+createdAt`; `requesterId+status+createdAt` |
| `blockedusers` (BlockedUser) | Block list | `blockerId`, `blockedId` | **unique** `blockerId+blockedId`; `blockedId` |
| `achievements` (Achievement) | Achievement catalogue (seeded on boot) | `key`, `name`, `description`, `category`, `metric`, `target`, `reward{xp,points}` | **unique** `key` |
| `userachievements` (UserAchievement) | Per-player progress/unlocks | `userId`, `achievementKey`, `progress`, `unlockedAt` | **unique** `userId+achievementKey`; `userId+unlockedAt` |
| `notifications` (Notification) | Notification history | `userId`, `type`, `category`, `title`, `body`, `data`, `readAt`, `expireAt` | `userId+createdAt desc`; `userId+readAt`; **TTL** `expireAt` |
| `leaderboardentries` (LeaderboardEntry) | Daily/weekly/monthly boards | `userId`, `period`, `periodKey`, `points`, `wins`, `games`, `expireAt` | **unique** `period+periodKey+userId`; `period+periodKey+points desc`; `period+periodKey+wins desc`; **TTL** `expireAt` |
| `devicetokens` (DeviceToken) | FCM tokens | `userId`, `token`, `platform` android/ios, `deviceName`, `lastSeenAt` | **unique** `token`; `userId`; **TTL** `lastSeenAt` (90 d) |
| `reports` (Report) | Player reports | `reporterId`, `reportedId`, `gameId`, `reason`, `details`, `status` | `reportedId+status`; `reporterId+reportedId+createdAt` |
| `auditlogs` (AuditLog) | Sensitive-action audit trail | `userId`, `action`, `ip`, `meta`, `expireAt` | `userId+createdAt`; `action+createdAt`; **TTL** `expireAt` |

## Relationships

```
User 1─* RefreshToken        User 1─* DeviceToken       User 1─* Notification     User 1─* UserAchievement ─* Achievement(key)
User *─* User (Friendship, BlockedUser)                 User 1─* LeaderboardEntry (per period)
Game *─* User (players[], playerIds[])   Game 1─* Move   Game *─1 Room (roomId)   Room 1─0..1 Game (gameId, the current game)
MatchmakingTicket *─1 User, ─0..1 Game
```

No data is duplicated on purpose: all-time leaderboards read `users.stats` directly; per-period boards hold only the
increments of that period; player cards (name/avatar/level) are looked up from `users` when needed.

## Design notes

* **Moves are atomic.** The authoritative `board`, `currentTurn`, `moveCount` and the win/draw result live on the game
  document and change in one guarded `findOneAndUpdate` (status, turn, empty cell and previous `moveCount` are in the filter).
  The `moves` collection is the append-only log used for history/replay; its unique indexes are a second line of defence.
* **Finalization is idempotent.** `games.finalizedAt` is flipped `null → date` by a compare-and-set before any statistic is
  applied, so retries, concurrent calls and duplicate events can never double count.
* **Statistics are applied with an aggregation-pipeline update** (single atomic document update incl. streaks and level).
* **Soft account deletion.** `users` keeps an anonymised shell (`Deleted Player`) so finished games of opponents stay intact;
  email, password, tokens, device tokens, notifications, friendships and blocks are removed.

## Retention & cleanup

| Data | Policy | Mechanism |
|---|---|---|
| Refresh tokens | removed at expiry (30 d, guests 90 d); rotated tokens stay (revoked) until expiry for reuse detection | TTL `expiresAt` |
| Notifications | 90 days | TTL `expireAt` |
| Device tokens | 90 days since last registration/refresh; invalid tokens are deleted when FCM reports them | TTL `lastSeenAt` + push service |
| Cancelled / expired games | 1 day | TTL `purgeAt` |
| Finished games and moves | 365 days | TTL `purgeAt` / `expireAt` |
| Matchmaking tickets | queue expiry + 1 day | TTL `purgeAt` |
| Rooms | expiry + 7 days | TTL `purgeAt` |
| Daily / weekly / monthly leaderboard rows | 40 / 120 / 400 days | TTL `expireAt` |
| Audit logs | 180 days | TTL `expireAt` |
| Abandoned unstarted games, stale tickets/rooms, offline presence | swept every 3–30 s | `src/jobs` (idempotent, safe on every instance) |

MongoDB's TTL monitor runs about once a minute, so deletion is eventually consistent.
