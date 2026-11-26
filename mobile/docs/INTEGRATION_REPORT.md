# Integration report: mobile app <-> backend

Source of truth: backend source + generated `backend/docs/API.md` (69 endpoints) and `backend/docs/SOCKET_EVENTS.md`.

## 1. Screens (40 + notifications inbox)

| # | Route | File | Data source |
|---|---|---|---|
| 1 | splash | screens/onboarding/SplashScreen | auth bootstrap (SecureStore + `GET /users/me`) |
| 2-4 | onboarding_1..3 | screens/onboarding/OnboardingScreens | static |
| 5 | welcome | screens/onboarding/WelcomeScreen | `POST /auth/guest`, Google/Apple (`/auth/google`, `/auth/apple`) |
| 6 | home (tab) | screens/home/HomeScreen | `GET /users/me`, notifications, SQLite (resume), online store |
| 7 | game_mode (tab) | screens/home/GameModeScreen | static navigation |
| 8 | match_setup (LOCAL_2P) | screens/offline/MatchSetupScreen | local setup store |
| 9 | game_rules | screens/home/GameRulesScreen | engine win lengths |
| 10 | offline_board | screens/game/GameBoardScreen | shared engine (no network) |
| 11 | (removed: Pass n play goes straight to match_setup) | - | - |
| 12 | match_setup (VS_AI) | screens/offline/MatchSetupScreen | engine (5 levels) |
| 14 | game_result | screens/game/GameResultScreen | local game store / SQLite |
| 15 | rematch | screens/offline/RematchScreen | local game store |
| 16 | offline_history | screens/offline/OfflineHistoryScreen | SQLite |
| 17 | online_lobby | screens/online/OnlineLobbyScreen | `GET /games/active`, friends |
| 18 | matchmaking | screens/online/MatchmakingScreen | `matchmaking:*` socket events |
| 19 | waiting_room | screens/online/WaitingRoomScreen | `room:*` events, `/rooms/:id/*` |
| 20 | online_board | screens/game/GameBoardScreen | `game:*` events (server-authoritative) |
| 21 | create_room | screens/online/CreateRoomScreen | `POST /rooms` |
| 22 | join_room | screens/online/JoinRoomScreen | `POST /rooms/join` |
| 23 | room_details | screens/online/RoomDetailsScreen | rooms API + invite |
| 24 | online_result | screens/game/GameResultScreen | server game result, `GET /games/:id/replay` |
| 25 | reconnection | screens/online/ReconnectionScreen | socket status + `GET /games/:id` |
| 26 | match_invitation | screens/online/MatchInvitationScreen | `/games/:id/join`, `/rooms/join` |
| 27-28 | login, registration | screens/auth | `/auth/login`, `/auth/register`, `/auth/upgrade` |
| 29 | otp_verification | screens/auth/OtpVerificationScreen | `/auth/verify-email` (6-digit), `/auth/resend-verification` |
| 30 | forgot_password | screens/auth/ForgotPasswordScreen | `/auth/forgot-password`, `/auth/reset-password` (6-digit) |
| 31-32 | user_profile (tab), edit_profile | screens/profile | `/users/me` (GET/PATCH), streaks |
| 33-34 | leaderboard (tab), friends (tab) | screens/social | `/leaderboard/*`, `/friends/*`, `/users/search` |
| 35 | friend_profile | screens/social/FriendProfileScreen | `/users/:id`, friends, block, report |
| 36-38 | game_statistics, achievements, daily_rewards | screens/progression | `/statistics/*`, `/achievements/me`, `/rewards/daily*` |
| 39-40 | settings, theme_selection | screens/settings | `PATCH /users/me`, auth |
| + | notifications | screens/settings/NotificationsScreen | `/notifications*` |

## 2. Backend changes made for the app (all backward compatible)

* **Six-digit email OTP** (verification + password reset): CSPRNG codes, only an HMAC is stored, 10 min expiry, 5 attempts then lock,
  60 s resend cooldown, 5 sends/hour, single use, never returned by the API and never logged (dev mails go to `backend/.dev-mail/`).
  The previous link-token flows keep working. New: `POST /auth/resend-verification`; `verify-email` and `reset-password` accept
  `{ email, code }` in addition to `{ token }`.
* **Daily rewards**: `GET /rewards/daily`, `POST /rewards/daily/claim`, `GET /rewards/daily/history`. 7-day cycle (100/150/200/250/350/450/750),
  per-user IANA timezone, consecutive-day rule (a skipped local day resets to day 1), compare-and-set claim + unique (user, day) index,
  time-zone changes limited to once per 7 days (stops claiming twice by hopping zones). The prototype's day-7 "Neon Frame" cosmetic was
  dropped (no inventory system exists).
* **Profile**: `bio` (<=160), `timezone`, `wallet.coins` (server-only), all six themes (`dark light classic neon ocean sunset`).
* **Bug found by the live test**: `game:finished` / `game:draw` were emitted before outcomes/points were finalized, and the move ack
  carried the pre-finalization game. Both now carry the finalized game (covered by a backend e2e assertion + a client guard).

## 3. Decisions and deviations from the prototype

* Board sizes 3/4/5 (the prototype's 5 and 6 became 4 and 5); five AI levels; win length 3/4/4.
* `coins` come only from daily rewards; achievements reward XP (not coins); "rating" is `stats.points`.
* Prototype features with no backend equivalent were removed rather than faked: in-game chat, head-to-head history, 7-day trend chart,
  phone number on registration, Help/Privacy rows without a destination.
* Language picker stores the choice but the UI is English-only (no translation system yet); the screen says so.
* Avatars are preset ids; they are sent to the server as `avatar_N` (backend validator) and mapped back (`constants/avatars.ts`).
* iOS push: see `docs/IOS_RELEASE.md` (FCM needs the Firebase iOS SDK; not included).

## 4. What was actually verified

| Check | Result |
|---|---|
| Backend: `tsc`, 129 Vitest tests (OTP, rewards, concurrency, sockets, engine) | pass |
| Mobile: `tsc --noEmit` (strict) | pass |
| Mobile: Jest, 16 suites / 238 tests (engine, parity, API client + refresh, offline sync, deep links, stores, all screen groups) | pass |
| **Live end-to-end** (`tests/integration/liveBackend.test.ts`): the app's own API client, auth store, socket client, session bridge and online actions against the real backend: guest + registered auth, OTP flow, token rotation/refresh (incl. concurrent), profile/theme, daily reward claim + duplicate, offline sync + duplicate + forged match rejected, quick match between two clients, live moves, server-decided win, duplicate-submit protection, stats/history/leaderboard/achievement updates, friends, private room, socket drop + restore, forfeit | pass (3 consecutive runs) |
| Metro bundles the Android JS (Hermes) | pass |
| Android APK/AAB build | see section 5 |

**Not verified (no device/emulator/Mac in the development environment):** rendering and layout on real Android/iOS screens
(safe areas, keyboard, small/large devices), animations at runtime, haptics/sound output, Google/Apple sign-in against real providers,
FCM push delivery, two physical devices, any iOS build. The UI was ported from the prototype and unit-tested, but it has not been
looked at on a screen.

## 5. Android build

(see the final section appended after the build)
