# Setup, deployment and operations

## 1. Local development

Requirements: Node.js ≥ 20 (developed on 22) and MongoDB 6+ (Redis is optional).

```bash
npm install
cp .env.example .env            # then set JWT_ACCESS_SECRET (>= 32 chars)
# MongoDB: use your own instance (MONGODB_URI) ...
npm run dev                     # API + sockets with reload on http://localhost:4000
# ... or, with no MongoDB installed, a throwaway in-memory one (data is lost on exit):
npm run dev:mongo               # terminal 1  -> mongodb://127.0.0.1:27017/tictactoe
npm run dev                     # terminal 2
```

* Swagger UI: `http://localhost:4000/api/docs` (raw spec: `/api/openapi.json`)
* Health: `GET /api/v1/health` · Version: `GET /api/v1/version`
* `npm test` – 100+ automated tests (engine/AI, auth, games, matchmaking, rooms, sockets, friends, leaderboards, DB constraints).
  They start their own in-memory MongoDB (`mongodb-memory-server`; the first run downloads the mongod binary).
* `npm run typecheck`, `npm run build` (→ `dist/`), `npm start` (runs `dist/server.js`), `npm run docs:api` (regenerates `docs/API.md`).

### Physical devices & emulators (React Native)

`localhost` on a phone is the phone itself. Use the machine's LAN IP (e.g. `http://192.168.1.20:4000`), the Android emulator alias
`http://10.0.2.2:4000`, or an HTTPS tunnel/staging URL. The mobile app reads it from environment config – see
`docs/react-native/config.ts`. Add the origin of any web client to `CORS_ORIGINS` (native apps send no `Origin`).

## 2. Environment variables

See `.env.example` (every variable is documented there and validated at boot – the server refuses to start with a bad config).

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string (use `mongodb+srv://` for Atlas) |
| `JWT_ACCESS_SECRET` | ≥ 32 random chars. Rotate by deploying a new value (all access tokens expire in 15 min, refresh tokens stay valid) |
| `CORS_ORIGINS` | Comma separated allow-list; `*` is refused in production |
| `TRUST_PROXY` | `true` behind a load balancer/reverse proxy (correct client IP for rate limits) |
| `REDIS_URL` | Optional. Enables the Socket.IO Redis adapter (required for > 1 instance) |
| `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_ID` | Audiences accepted for social login (the endpoints answer `503 PROVIDER_NOT_CONFIGURED` otherwise) |
| `SMTP_*`, `MAIL_FROM`, `APP_BASE_URL` | Verification / reset emails (without SMTP they are only logged outside production) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` / `_PATH` | Enables FCM push (Android + iOS via APNs) |
| `TURN_TIMEOUT_SEC`, `DISCONNECT_GRACE_SEC`, `MATCH_QUEUE_TTL_SEC`, `ROOM_TTL_MIN` | Gameplay timers |
| `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_MAX`, `SOCKET_EVENTS_PER_SEC` | Abuse protection |

Never commit `.env` or service-account files (both are in `.gitignore`/`.dockerignore`). In production inject secrets via your
platform's secret manager.

### Firebase Cloud Messaging

1. Firebase console → Project settings → Service accounts → *Generate new private key*.
2. Provide it as `FIREBASE_SERVICE_ACCOUNT_JSON` (single line) or mount the file and set `FIREBASE_SERVICE_ACCOUNT_PATH`.
3. iOS: upload your APNs key in Firebase (Cloud Messaging → Apple app configuration). The app registers its FCM token with
   `POST /api/v1/devices/register { token, platform: "android" | "ios" }` and removes it on logout with `DELETE /api/v1/devices/:id`.
4. Pushes are sent only when the user has **no live socket**; users who are online receive `notification:new` over Socket.IO instead.

## 3. Docker

```bash
export JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
docker compose up --build -d                      # api (:4000) + mongo
docker compose --profile scale up --build -d \    # + redis; run several API replicas
  --scale api=3                                   #   (set REDIS_URL=redis://redis:6379 and put a load balancer in front)
docker compose logs -f api
```

The image is multi-stage (build → prod deps → runtime), runs as the unprivileged `node` user under `tini` (so `SIGTERM` reaches the
graceful-shutdown handler), and has a `HEALTHCHECK` on `/healthz` (liveness, never touches MongoDB). With several replicas the load balancer must allow WebSocket upgrades
(Socket.IO also works with sticky sessions disabled when clients use `transports: ['websocket']`, as the examples do).

## 4. Production checklist

* **HTTPS everywhere.** Terminate TLS at a reverse proxy / load balancer and set `TRUST_PROXY=true`. Example Caddy (automatic certificates, WebSocket-safe):
  ```
  api.example.com {
    reverse_proxy localhost:4000
  }
  ```
  Nginx: `proxy_pass http://127.0.0.1:4000; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 75s;`
  Mobile apps must use `https://` / `wss://` (iOS ATS and Android cleartext rules block plain HTTP).
* **CORS** – set `CORS_ORIGINS` to the exact web origins you serve (native apps do not need an entry).
* **Secrets** – strong `JWT_ACCESS_SECRET`, SMTP and Firebase credentials from a secret manager.
* **MongoDB** – use a replica set (Atlas or self-hosted, ≥ 3 nodes), authentication on, network-restricted, TLS.
* **Backups** – Atlas continuous backup/PITR, or nightly `mongodump --uri "$MONGODB_URI" --gzip --archive=backup.gz` shipped off-host, with a
  *tested* `mongorestore` procedure. Per-period leaderboard rows and tickets are disposable; `users`, `games`, `moves` are the data that matters.
* **Scaling** – run ≥ 2 replicas behind the load balancer with `REDIS_URL` set. Jobs and all state transitions are idempotent/atomic, so every
  replica can run them. MongoDB handles matchmaking and game state; Redis only carries Socket.IO fan-out.
* **Health & probes** – Kubernetes: `livenessProbe` → `GET /healthz`, `readinessProbe` → `GET /readyz` (503 until MongoDB, indexes and seed data are initialised and again during shutdown). **Render**: set the dashboard health check path to `/readyz` so traffic is only routed once the app is ready; keep `/api/v1/health` for external monitoring. The HTTP port opens immediately on `0.0.0.0:$PORT`; until ready, API and Socket.IO requests get a retryable `503 SERVICE_STARTING`. Startup-stage timings are logged as `startup stage` lines. Email calls time out after `MAIL_TIMEOUT_MS` (default 10000); `terminationGracePeriodSeconds: 20`.
* **Logging & monitoring** – logs are structured JSON on stdout (pino; tokens and passwords redacted; each request has `requestId`, also returned in the
  `X-Request-Id` header and error bodies; `channel: "audit"` lines mark sensitive actions). Ship them with your platform's log driver
  (CloudWatch, Loki, Datadog…). Alert on: `/health` failures, 5xx rate, `auth.refresh_reuse_detected`, repeated `auth.login_failed`, event-loop lag, Mongo
  connections/slow queries. For error monitoring add Sentry's `@sentry/node` init at the top of `src/server.ts` (not bundled to avoid a vendor lock-in).
* **Cloud targets** – the container runs unchanged on AWS ECS/Fargate (ALB with WebSocket support + ElastiCache + DocumentDB/Atlas), Google Cloud Run
  (set min instances ≥ 1, session affinity on, and use Memorystore + Atlas), Azure Container Apps, Fly.io, Render or Railway. Always provide the
  environment variables above, expose port 4000 and configure the health check path.

## 5. Operations

| Task | How |
|---|---|
| Force-logout a user | `RefreshToken.updateMany({ userId }, { revokedAt })` (access tokens die within 15 min) |
| Inspect sensitive activity | `db.auditlogs.find({ userId }).sort({ createdAt: -1 })` |
| Review reports | `db.reports.find({ status: "OPEN" })` |
| Add an achievement | append to `ACHIEVEMENT_DEFINITIONS` in `src/services/achievement.service.ts` (re-seeded on boot) |
| Tune points | `POINTS` in `src/constants/index.ts` (affects future games only) |
