# Tic Tac Toe – backend

Production-oriented backend for a Tic Tac Toe mobile game (React Native, Android + iOS): **Node.js · TypeScript (strict) · Express ·
MongoDB/Mongoose · Socket.IO · JWT**. Offline and online play, 3x3/4x4/5x5 boards, five AI levels, guest + registered accounts, quick
matchmaking, private rooms, live multiplayer with reconnection, friends, leaderboards, statistics, achievements, notifications (FCM) and
a server-authoritative game engine.

```bash
npm install
cp .env.example .env          # set JWT_ACCESS_SECRET (>= 32 chars) and MONGODB_URI
npm run dev:mongo             # optional: throw-away in-memory MongoDB on :27017 (if you have no MongoDB)
npm run dev                   # http://localhost:4000  ·  Swagger UI: /api/docs
npm test                      # 112 automated tests (own in-memory MongoDB)
docker compose up --build     # api + mongo (see docs/SETUP.md for Redis / scaling)
```

## Documentation

| Doc | Content |
|---|---|
| [docs/API.md](docs/API.md) | Every REST endpoint: params, body, auth, validation, errors, example request/response (generated) · live Swagger at `/api/docs` |
| [docs/SOCKET_EVENTS.md](docs/SOCKET_EVENTS.md) | Every Socket.IO event with payloads, acks and flows |
| [docs/DATABASE.md](docs/DATABASE.md) | Collections, indexes, constraints, retention |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, atomic game logic, matchmaking, security model, **known limitations** |
| [docs/SETUP.md](docs/SETUP.md) | Local setup, env vars, Docker, HTTPS, backups, monitoring, cloud deployment |
| [docs/react-native](docs/react-native/README.md) | Axios client + JWT interceptor, secure storage, Socket.IO client, hooks, offline engine |

## Project layout

```
src/
  config/ constants/ types/ utils/        env validation, logger, db, redis · enums & scoring · helpers
  game-engine/                            PURE TS (shared with the app): rules, win lines, 5 AI levels, offline LocalGame
  models/                                 14 required collections (+ audit log) with indexes & TTL retention
  validators/ middleware/                 zod schemas · auth, validation, sanitising, rate limit, errors
  routes/ controllers/ services/          declarative route table (drives Express + OpenAPI + API.md) · thin controllers · business logic
  matchmaking/ sockets/ jobs/             queue (atomic claims) · authenticated Socket.IO + events · timeouts/sweepers
  docs/                                   OpenAPI builder + doc examples
  app.ts  server.ts                       Express app · bootstrap, Redis adapter, graceful shutdown
tests/  unit/ integration/ e2e/           Vitest + Supertest + socket.io-client + mongodb-memory-server
scripts/                                  generate-api-docs.ts, dev-mongo.ts
```

## Feature coverage

| Area | Status |
|---|---|
| Game engine: 3x3/4x4/5x5, configurable win length, win/draw detection, undo, restart, timer, score, move history, offline record | ✅ implemented + unit tested |
| AI: Easy (random), Medium (win/block), Hard (depth-2 alpha-beta), Expert (iterative-deepening alpha-beta), Impossible (full alpha-beta on 3x3, deeper search on larger boards); never plays an invalid move | ✅ tested (Impossible never loses 3x3, ties itself) |
| Auth: guest, email register/login, JWT access + rotating hashed refresh tokens with reuse detection, logout / logout-all, forgot/reset, email verification, guest upgrade, account deletion, profile management | ✅ tested |
| Google / Apple login | ✅ implemented (JWKS verification), tested with a stubbed verifier – **not tested against the live providers** |
| Server-authoritative online games: turn/cell/membership validation, atomic moves, idempotency, conflict handling, forfeit, timeouts, disconnect handling, rematch | ✅ tested (incl. concurrent moves) |
| Quick matchmaking (atomic claims, one queue per user, cancel/expiry, block-aware) | ✅ tested (incl. simultaneous joins) |
| Private rooms (secure code, capacity, host promotion, readiness, start, invite, expiry, rematch in room) | ✅ tested |
| Socket.IO: JWT handshake, validated/rate-limited events, ack protocol, rooms, reconnect/resume | ✅ tested with real socket clients |
| Friends, blocking, presence, invites, reports | ✅ tested |
| Leaderboards (global/daily/weekly/monthly/friends, points/wins), statistics, history, replay, streaks | ✅ tested |
| Achievements, XP, levels, rewards | ✅ tested |
| Notifications: history, read state, preferences, live delivery, device tokens | ✅ tested |
| FCM push (Android/iOS) | ✅ implemented, push-vs-live routing tested via a hook – **not tested against Firebase** |
| Redis Socket.IO adapter (multi-instance) | ✅ implemented – **not tested** (no Redis available in the build environment) |
| Docker / compose | ✅ written – **not built or run** (no Docker available in the build environment) |
| Two physical devices | ❌ not possible in this environment; multiplayer was verified with two real Socket.IO clients over WebSocket against the running server |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#known-limitations-deliberate-trade-offs) for deliberate trade-offs.
