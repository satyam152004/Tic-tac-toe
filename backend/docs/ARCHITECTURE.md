# Architecture

```
React Native app ──REST (Axios)──▶ Express ─▶ routes (declarative table) ─▶ validators (zod) ─▶ controllers ─▶ services ─▶ Mongoose models ─▶ MongoDB
        │                                                                                                  ▲
        └────Socket.IO (JWT auth)──▶ sockets/ (validated, rate-limited events) ─▶ the SAME services ───────┘
                                              ▲                         │
                         Redis adapter (optional, N instances)          └─▶ realtime hub ─▶ rooms user:<id> / game:<id> / room:<id>
                         jobs/ (timeouts, matchmaking sweep, room expiry, presence)
```

| Layer | Folder | Responsibility |
|---|---|---|
| Game engine | `src/game-engine` | **Pure TypeScript, zero dependencies**: board, win lines, move rules, 5 AI levels, offline `LocalGame` state machine. Imported by the server *and* copied into the React Native app (see `docs/react-native`) so offline and online use identical rules |
| Config | `src/config` | env validation (fails fast), logger (pino, secret redaction), Mongo, Redis |
| Models | `src/models` | Mongoose schemas, validation, indexes, TTL retention |
| Routes | `src/routes` | One declarative table: path, auth, zod schemas, docs. It builds the Express router, the OpenAPI document and `docs/API.md` |
| Validators | `src/validators` | zod schemas shared by REST and Socket.IO |
| Controllers | `src/controllers` | Thin: unpack request → call service |
| Services | `src/services`, `src/matchmaking` | All business logic. REST, sockets and jobs call the same functions, so rules cannot diverge |
| Sockets | `src/sockets` | Auth middleware, event registration (rate limit → sanitise → validate → handler → ack) |
| Jobs | `src/jobs` | Periodic idempotent maintenance |

## Server-authoritative gameplay

The client only ever sends *intent* (`position`). The server decides everything else:

1. **Membership & turn** – the caller must be in `game.playerIds` and hold the mark in `currentTurn`.
2. **Rules** – the shared engine validates range/occupancy and computes the outcome on the hypothetical board.
3. **Atomic commit** – one `findOneAndUpdate` with the filter
   `{ _id, status: IN_PROGRESS, currentTurn: mark, moveCount: n, 'board.<pos>': '' }` that sets the cell, flips the turn, bumps `moveCount`
   and – if the move ends the game – also writes `status`, `result.winner/line/reason`, `endedAt`. If two moves race, exactly one matches
   the filter; the loser gets `NOT_YOUR_TURN`/`MOVE_CONFLICT` and the board is never corrupted.
4. **Move log** – a `moves` document with unique `(gameId, moveNumber)`, `(gameId, position)` and `(gameId, playerId, clientMoveId)`.
5. **Idempotency** – a repeated `clientMoveId` returns the stored move instead of failing or double-applying.
6. **Broadcast** – `game:updated` to the `game:<id>` channel, plus `game:finished` / `game:draw` for terminal moves.
7. **Finalization** – `finalizeGame` flips `finalizedAt` (compare-and-set) and then applies stats, points, XP, level, streaks, per-period
   leaderboard rows and achievements in one pass. Winners, scores and rewards are never taken from a client.

Other transitions use the same pattern: forfeits/timeouts/disconnect-forfeits (`concludeGame`), cancellation of unstarted games, starting
a game (`READY → IN_PROGRESS` exactly once), rematch (`rematchGameId` claimed with `null → id`), room start (`READY → PLAYING`).

Anti-abuse rules: games abandoned before both players moved never count; invited (friend / private room) games earn half points; offline
results only touch separate `local*` counters and are verified by replaying the submitted moves through the engine.

### Game lifecycle

```
WAITING ──(friend joins)──▶ READY ──(all humans game:join)──▶ IN_PROGRESS ──▶ COMPLETED | DRAW
   │                          │                                   │ (timeout / forfeit / disconnect → COMPLETED)
   └──(10 min)──▶ EXPIRED     └──(60 s / forfeit)──▶ CANCELLED
```
AI games start directly in `IN_PROGRESS` and the server plays the AI reply inside the same request.

## Matchmaking

1. `matchmaking:join` validates the user and refuses if they are already in an active online game.
2. A ticket is inserted; a **partial unique index** (`userId` where `QUEUED`) means a user can hold only one queue entry, on any instance.
3. The oldest compatible ticket (same board size & win length, not blocked either way, not expired) is claimed with an **atomic
   `findOneAndUpdate` QUEUED → MATCHED**. Then the caller's own ticket is claimed the same way; if that fails (they were claimed
   concurrently or cancelled) the opponent is released back to the queue.
4. A `READY` game is created with random X/O, both users' sockets are placed in `game:<id>`, both get `matchmaking:found`.
5. Both `game:join`; the game starts when the last one joins. A sweeper cancels `READY` games that nobody joined within 60 s,
   expires tickets after `MATCH_QUEUE_TTL_SEC`, and retries pairing for tickets queued at the same instant.

Because claims are atomic in MongoDB, **matchmaking is correct on any number of instances without Redis**. Redis (`REDIS_URL`) powers the
Socket.IO adapter so `matchmaking:found`, moves and notifications reach players connected to *other* instances. Without Redis (development,
single instance) the in-process adapter is used.

## Connection handling

* Presence: first socket of a user → `online = true` (friends get `player:connected`); last socket gone → `online = false`.
* Disconnect during a running game → `disconnectedAt.<mark>` is set and the opponent gets `player:disconnected` (with the grace period).
  A reconnect clears it (`player:reconnected`). A job forfeits players still gone after `DISCONNECT_GRACE_SEC`.
* Reconnect restores state: the server re-joins the socket to its active games and replays the latest authoritative state.
* Turn clocks (`TURN_TIMEOUT_SEC`) are enforced by a job using the stored `turnDeadline`.

## Security model

* **Auth** – short-lived JWT access tokens (HS256, 15 min) + opaque 48-byte refresh tokens stored only as SHA-256 hashes. Refresh tokens
  are **rotated on every use**; presenting an already-rotated token revokes the whole session family (theft detection). Concurrent
  refreshes are serialised by an atomic claim. Mobile clients keep the refresh token in the OS keychain/keystore and send it in the
  request body – no cookies involved.
* **Passwords** – bcrypt (cost 12); login does a dummy comparison for unknown emails (no timing oracle); identical error for unknown
  email / wrong password; forgot-password never reveals whether an email exists; reset tokens are single use and revoke all sessions.
* **Input** – every REST body/query/param and every socket payload goes through zod (unknown keys stripped or rejected); a sanitizer
  removes `$`/`.` keys (NoSQL operator injection); `express.json` limit 100 kB; Socket.IO `maxHttpBufferSize` 100 kB.
* **Access control** – ownership checks in every service (`playerIds`, room membership, notification owner, device owner,
  friendship party); blocked users are invisible to the blocker; profile updates are an allow-list (stats cannot be written).
* **HTTP hardening** – Helmet, strict CORS allow-list (rejects `*` in production), rate limits (global + stricter on credential endpoints),
  centralised error handler that never leaks stack traces in production, `x-powered-by` disabled.
* **Sockets** – JWT handshake auth, per-socket token bucket, server-controlled channel membership, uniform ack errors.
* **Logging** – pino with redaction of tokens/passwords; audit trail (`auditlogs` + `audit` log channel) for register/login/failed login/
  logout/password reset/refresh-reuse/guest upgrade/account deletion/block/report.

### Known limitations (deliberate trade-offs)

* Access tokens are stateless: after logout/logout-all/account deletion an already issued access token stays valid until it expires
  (≤ `ACCESS_TOKEN_TTL_SEC`, 15 min). Refresh and socket re-auth are blocked immediately. Lower the TTL if that window is too long.
* Moves are not wrapped in a multi-document transaction (standalone MongoDB has none). The game document is authoritative and written
  atomically; if the follow-up `moves` insert were to fail, the error is logged, the board stays correct, and only that history row is missing.
* Stats application after the `finalizedAt` claim is *at most once*: a process crash between the claim and the stat updates would skip
  that game's stats (never double count). Use a replica set + transactions if you need exactly-once under crashes.
* AI search for Expert/Impossible runs on the event loop within a small time budget (≤ 0.25 s / ≤ 0.7 s on 4x4–5x5; solved 3x3 is instant).
  For very high AI traffic move it to a worker pool.
* Google/Apple sign-in verify provider JWTs with the providers' JWKS; they were unit-tested with a stubbed verifier, not against live providers.
