# Socket.IO events

Endpoint: same origin as the REST API (`$API_URL`), default Socket.IO path `/socket.io`.

## Connecting & authentication

Every connection must present a valid **access token**:

```ts
const socket = io(API_URL, { auth: { token: accessToken }, transports: ['websocket'] });
```

* No/invalid token → `connect_error` with `err.data.code = "UNAUTHORIZED" | "INVALID_TOKEN"`.
* Expired token → `err.data.code = "TOKEN_EXPIRED"`: call `POST /auth/refresh`, then reconnect with the new token.
* When a connection is established the server joins the socket to its private channel (`user:<id>`), re-joins all of the
  user's unfinished games, and sends `session:ready` followed by a `game:updated` (`resumed: true`) per unfinished game.
  **Wait for `session:ready` before emitting events.**
* Clients can never choose which channel they are in. A socket is only added to `game:<id>` / `room:<id>` by the server
  after membership was verified, so nobody can listen to, or broadcast into, a game they do not play.

## Acknowledgements (client → server)

Every client event takes an optional ack callback and always gets one reply:

```ts
socket.emit('game:move', { gameId, position: 4 }, (res) => {
  // success: { ok: true,  data: <same payload as the REST endpoint> }
  // failure: { ok: false, error: { code: 'NOT_YOUR_TURN', message: '...', details?: ... } }
});
```

Payloads are sanitised (keys starting with `$` or containing `.` are stripped) and validated with zod; a bad payload
returns `VALIDATION_ERROR` with `details: [{ path, message }]`. Each socket has a token bucket
(`SOCKET_EVENTS_PER_SEC`, default 20/s); exceeding it returns `RATE_LIMITED`, and persistent flooding disconnects the socket.
All events act for the **authenticated** user only; no user id is ever read from a payload.

## Client → server

| Event | Payload | Ack `data` | Notes / error codes |
|---|---|---|---|
| `matchmaking:join` | `{ boardSize?: 3\|4\|5 (default 3), winLength?: 3..5 }` | `{ status: "QUEUED"\|"MATCHED", ticket, alreadyQueued?, game? }` | Idempotent: a second join returns `alreadyQueued: true`. `ALREADY_IN_GAME`, `INVALID_BOARD_CONFIG` |
| `matchmaking:cancel` | – | `{ cancelled: boolean }` | |
| `game:join` | `{ gameId }` | Game state | Confirms presence. When every human player has joined, the game starts (`game:started`). Invited friends accept a `WAITING` friend game with it. `NOT_A_PLAYER`, `GAME_NOT_FOUND` |
| `game:move` | `{ gameId, position: 0..24, clientMoveId?: string(8-64, [A-Za-z0-9_-]), expectedMoveNumber?: int }` | `{ game, move, aiMove?, duplicate }` | Also emits `game:move-rejected` to the caller on failure. `NOT_YOUR_TURN`, `CELL_OCCUPIED`, `CELL_OUT_OF_RANGE`, `GAME_NOT_ACTIVE`, `MOVE_CONFLICT`, `NOT_A_PLAYER` |
| `game:forfeit` | `{ gameId }` | Final game state | Forfeits a running game, or cancels one that has not started |
| `game:offer-draw` _(extra)_ | `{ gameId }` | Game state | Propose a mutual draw (online games, valid 20 s, one open offer). Opponent gets `game:draw-offered`. `DRAW_OFFER_PENDING`, `GAME_NOT_ACTIVE`, `NOT_SUPPORTED` |
| `game:respond-draw` _(extra)_ | `{ gameId, accept: boolean }` | Game state | Opponent answers: accept ends the game as a draw (`game:draw`), decline emits `game:draw-declined`. `NO_DRAW_OFFER`, `OWN_DRAW_OFFER` |
| `game:rematch` | `{ gameId }` | `{ status: "REQUESTED"\|"STARTED", game }` | Starts when both players asked. `GAME_NOT_FINISHED` |
| `game:spectate` _(extra)_ | `{ gameId }` | `{ game, players, spectators }` | Read-only watching of a live online game by an accepted friend of a player who allows spectating (`privacy.allowSpectating`). Joins the `spectate:<gameId>` channel: you then get every `game:*` event the players get. `NOT_A_FRIEND`, `SPECTATING_DISABLED`, `GAME_NOT_LIVE`, `ALREADY_A_PLAYER`, `BLOCKED` |
| `game:unspectate` _(extra)_ | `{ gameId }` | `{ left: true }` | Stop watching |
| `game:cheer` _(extra)_ | `{ gameId, kind: "clap"\|"fire"\|"wow" }` | `{ sent: true }` | Spectators only (`NOT_SPECTATING`); broadcast to players and spectators as `game:cheer` |
| `room:create` | `{ boardSize?, winLength? }` | Room | `ALREADY_IN_ROOM`, `ALREADY_IN_GAME` |
| `room:join` | `{ code: string(6) }` | Room | `ROOM_NOT_FOUND`, `ROOM_EXPIRED`, `ROOM_FULL`, `BLOCKED` |
| `room:leave` | `{ roomId }` | Room | Host leaving promotes the guest; leaving a running game forfeits it |
| `room:ready` _(extra)_ | `{ roomId, ready: boolean }` | Room | Guest only (host is always ready). Status `FULL` ⇄ `READY` |
| `room:start` _(extra)_ | `{ roomId }` | `{ room, game }` | Host only, both present and ready. `NOT_HOST`, `ROOM_NOT_READY` |
| `player:heartbeat` | – | `{ serverTime }` | Send every ~25 s. Silent clients are marked offline after 90 s |

**Idempotency / duplicates.** Send a fresh UUID as `clientMoveId` with every move and re-send the *same* id when retrying
after a timeout: the server stores accepted moves under a unique `(gameId, playerId, clientMoveId)` key, so a duplicate is
answered with the original move (`duplicate: true`) and is never applied twice.

## Server → client

| Event | Payload | When |
|---|---|---|
| `session:ready` | `{ userId, serverTime, activeGames: Game[] }` | Right after connect/reconnect, once the server finished setting up the session |
| `matchmaking:queued` | `{ ticket, alreadyQueued }` | You were put in the queue |
| `matchmaking:found` | `{ gameId, game, opponent: PlayerCard }` | Opponent found; you are already in the game channel. Confirm with `game:join` |
| `matchmaking:cancelled` | `{ reason: "CANCELLED"\|"EXPIRED" }` | Left the queue / ticket expired (`MATCH_QUEUE_TTL_SEC`) |
| `game:started` | `{ game, players: [{ mark, isAI, user: PlayerCard\|null }] }` | All players joined; status `IN_PROGRESS`; also for rematches |
| `game:updated` | `{ game, lastMove?: { moveNumber, position, mark, playerId }, resumed?: true }` | After every accepted move, forfeits/timeouts, cancellations, and on resume (`resumed: true` = replaying latest state after reconnect) |
| `game:move-rejected` | `{ gameId, clientMoveId?, position?, code, message, details? }` | To the **sender only**, when a move is refused |
| `game:finished` | `{ game }` | A player won (`result.reason`: `LINE`, `FORFEIT`, `TIMEOUT`, `DISCONNECT`) |
| `game:draw` | `{ game }` | Board full without a winner |
| `game:spectators` | `{ gameId, count }` | Number of friends currently watching changed |
| `game:cheer` | `{ gameId, kind, userId }` | A spectator sent a reaction |
| `game:draw-offered` | `{ gameId, by, expiresAt, moveCount }` | The opponent proposes a draw |
| `game:draw-declined` | `{ gameId, by }` | Your draw offer was declined |
| `game:rematch-requested` | `{ gameId, requestedBy }` | The opponent asked for a rematch |
| `game:rematch-accepted` | `{ previousGameId, game }` | Both agreed; `game` is the new `IN_PROGRESS` game with swapped marks |
| `player:connected` | `{ userId }` | A **friend** came online |
| `player:disconnected` | `{ userId }` (friend presence) **or** `{ gameId, userId, graceSeconds }` (opponent in your game) | Presence / opponent lost connection. After `DISCONNECT_GRACE_SEC` (30 s) without reconnecting the player forfeits |
| `player:reconnected` | `{ gameId, userId }` | Your opponent is back; the disconnect timer was cleared |
| `player:level-up` | `{ level }` | You levelled up |
| `player:achievement-unlocked` | `{ key, name, reward: { xp, points } }` | Achievement unlocked |
| `room:created` | `{ room }` | To the creator |
| `room:updated` | `{ room }` | Join/leave/ready/start of a room you are in (`room.gameId` is set when the host starts) |
| `room:expired` | `{ roomId, reason: "EXPIRED"\|"CANCELLED" }` | Room timed out (`ROOM_TTL_MIN`) or was cancelled |
| `notification:new` | `Notification` | A persisted notification for you (push is only sent if you have no live socket) |
| `friends:updated` | `{ blockedId }` | Your block list changed |
| `server:shutdown` | `{ reconnectInMs }` | Server is restarting: reconnect after the delay |

### Shapes

```ts
type Game = { id, type, status, boardSize, winLength, board: ('X'|'O'|'')[], currentTurn: 'X'|'O', moveCount,
  players: { userId: string|null, mark, isAI, joined, outcome, pointsAwarded }[], difficulty, roomId, turnTimeoutSec,
  turnDeadline, startedAt, endedAt, durationMs, result: { winner, winnerId, line: number[], reason },
  rematch: { requestedBy: string[], gameId: string|null }, previousGameId, createdAt, serverTime };
type PlayerCard = { id, username, displayName, avatar, level, online };
type Room = { id, code, status: 'WAITING'|'FULL'|'READY'|'PLAYING'|'COMPLETED'|'EXPIRED', host: PlayerCard, guest: PlayerCard|null,
  hostId, guestId, boardSize, winLength, guestReady, gameId, expiresAt, createdAt };
type Notification = { id, type, category, title, body, data, readAt, createdAt };
```

## Reconnection recipe

1. On `disconnect`, show "reconnecting…" (the opponent sees `player:disconnected` with `graceSeconds`).
2. Reconnect with a valid access token (refresh first when it expired).
3. On `session:ready` you get `activeGames`; each also arrives as `game:updated` with `resumed: true` – render it as the truth.
   (REST fallback: `GET /games/active`.)
4. Re-send any move whose ack was never received, using the **same** `clientMoveId`.

## Typical flows

```
Quick match:  A: matchmaking:join ─▶ matchmaking:queued
              B: matchmaking:join ─▶ A,B: matchmaking:found
              A,B: game:join      ─▶ A,B: game:started
              X: game:move ─▶ A,B: game:updated … ─▶ game:finished | game:draw

Private room: host: room:create ─▶ room:created(code)   guest: room:join(code) ─▶ both: room:updated(FULL)
              guest: room:ready ─▶ room:updated(READY)  host: room:start ─▶ room:updated(PLAYING, gameId)
              both: game:join ─▶ game:started

Rematch:      A: game:rematch ─▶ B: game:rematch-requested   B: game:rematch ─▶ A,B: game:rematch-accepted + game:started
```
