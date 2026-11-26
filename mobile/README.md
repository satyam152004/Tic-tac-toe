# Tic Tac Toe – mobile app (Expo / React Native)

Native Android + iOS client for the existing backend in `../backend`. UI/UX follows the approved prototype in `../frontend-prototype`
(read-only reference). Offline play (2 players or vs AI) works with no network; online play, accounts, social features,
leaderboards and rewards use the real backend.

| Area | Choice |
|---|---|
| Runtime | Expo SDK 58 (development builds / prebuild), React Native 0.88, React 19, strict TypeScript |
| Navigation | React Navigation 7 (native stack + bottom tabs), one flat typed stack, route names = prototype ScreenIds |
| State | Zustand stores (auth, settings, local game, online game, network, toast) + TanStack Query for server state |
| Realtime | One `socket.io-client` connection per signed-in session (`src/services/socket`) |
| Storage | SecureStore (refresh token only), SQLite (offline matches + interrupted game), AsyncStorage (preferences) |
| Animation | Reanimated 4 (+ haptics and generated sound effects) |
| Tests | Jest 30 + `jest-expo` + React Native Testing Library 14 (+ a live end-to-end suite against the real backend) |

## Quick start

```bash
# 1. backend (needs MongoDB; or `npm run dev:mongo` for a throwaway in-memory one)
cd ../backend && npm install && npm run dev:mongo      # terminal 1
cd ../backend && npm run dev                           # terminal 2

# 2. app
cd mobile
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_URL (see below)
npx expo run:android          # development build (Expo Go is NOT enough: native modules)
```

`EXPO_PUBLIC_API_URL`: Android emulator `http://10.0.2.2:4000`, iOS simulator `http://localhost:4000`, physical device
`http://<LAN-IP>:4000` (development builds only). **Release builds require `https://`** (the app refuses to start otherwise).
This variable is inlined at bundle time: set it when building (`EXPO_PUBLIC_API_URL=https://api.yourdomain.com npm run build:android`).

## Scripts

| Script | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | all Jest suites (units, screens, store/services, live backend e2e) |
| `npm run sync:engine` | re-copy the backend game engine into `src/game-engine` (a parity test fails if it drifts) |
| `npm run sounds` / `node scripts/generate-icons.mjs` | regenerate sound effects / app icons |
| `npm run build:android` | `expo prebuild` + Gradle `assembleRelease` + `bundleRelease` (APK + AAB) |

## Layout

```
src/
  app/                 App root, lifecycle (session, foreground/background, deep links, push taps)
  navigation/          RootNavigator + Auth/Game/Online/Profile/Settings screen groups + MainTabNavigator
  screens/             onboarding, home, offline, online, auth, profile, social, progression, settings (40 screens + notifications)
  components/          common, game (GameBoard, SymbolMark, PlayerCard), feedback, navigation, profile (cards)
  design-system/       colors (6 themes), typography, spacing, radius, shadows, themes
  game-engine/         COPY of backend/src/game-engine (offline play + AI). Do not edit: `npm run sync:engine`
  services/api/        axios client (refresh single-flight, rotation) + one module per backend area
  services/socket/     socketClient, gameSocket, matchmakingSocket, sessionBridge (events -> stores)
  services/storage/    secureStorage (tokens), localGameStorage (SQLite)
  store/               zustand stores        hooks/  query hooks, game hooks, back guard
tests/                 unit, game, services, screens, integration (live backend)
```

## How the important pieces behave

* **Offline engine**: the backend and the app share one engine (3x3/4x4/5x5, win length 3/4/4, five AI levels). The server replays
  every uploaded offline match with the same code, so a forged result is rejected. Offline matches never award points/XP.
* **Online is server-authoritative**: the client only sends `position` + an idempotency `clientMoveId`; the server validates turn,
  cell and state and decides win/draw. The store applies server snapshots monotonically (late events can't roll the board back and
  a finalized result is never replaced by an earlier snapshot).
* **Tokens**: access token in memory only; refresh token in SecureStore. Refresh is single-flight (rotation-safe), a revoked
  session routes to the welcome screen.
* **Offline start**: with a stored session and no network the app opens with a cached profile; local games, history and settings work.
* **Deep links**: `tictactoe://join/ABC234` (room), `tictactoe://invite/<gameId>` (friend challenge); https app links with
  `EXPO_PUBLIC_LINK_HOST`.

See `docs/INTEGRATION_REPORT.md` (API/socket mapping, decisions, what is and is not verified) and `docs/IOS_RELEASE.md`.
