# React Native integration

Reference implementation of the mobile side. Android and iOS use exactly the same REST API and Socket.IO events.
The files compile under strict TypeScript against the backend contract (they are not part of this repo's build because they
need React Native dependencies).

## Install in the app

```bash
npm i axios socket.io-client react-native-keychain react-native-config uuid react-native-get-random-values @react-native-async-storage/async-storage
cd ios && pod install
```

Copy this folder into the app (e.g. `src/backend/`) and copy the backend's **`src/game-engine/`** folder next to it
(`src/backend/game-engine/`). The engine is pure TypeScript with no dependencies, so the same rules, AI and win detection run
offline in the app and authoritatively on the server.

| File | What it shows |
|---|---|
| `config.ts` | Environment specific API URL (no hard-coded `localhost`; emulator/device/prod), HTTPS enforcement in release builds |
| `tokenStorage.ts` | Secure token storage: refresh token in Keychain/Keystore, access token in memory only |
| `apiClient.ts` | Axios client, JWT request interceptor, **single-flight refresh + replay** on `TOKEN_EXPIRED`, typed helpers (`Auth`, `Games`, `Devices`, `syncLocalMatches`) |
| `socketClient.ts` | Authenticated Socket.IO client: handshake token, refresh-and-reconnect, heartbeat, ack/timeout helper, **idempotent move sending** |
| `hooks.ts` | `useMatchmaking`, `useOnlineGame` (live sync + reconnection restore), `useOfflineGame` (no network) and `syncOfflineMatches` |
| `errors.ts` | Error normalisation (`ApiError`), user-friendly messages, session-dead codes |
| `types.ts` | Response/event TypeScript interfaces and shared game types |

## Key rules for the mobile client

1. **Tokens.** Never store tokens in `AsyncStorage`. Keep the refresh token in the Keychain/Keystore, the access token in memory. After
   `POST /auth/refresh` **always persist the new refresh token** – the previous one is invalidated, and replaying it revokes the session.
   Serialise refreshes (see `refreshTokens()`), otherwise two parallel calls look like token theft.
2. **Guest first.** `Auth.guest()` on first launch gives the user a playable account immediately; `Auth.upgradeGuest()` converts it into a
   registered account without losing progress.
3. **Offline vs online.** Offline modes (`useOfflineGame`) never touch the network. Finished offline matches are stored locally and
   uploaded later with `syncOfflineMatches()`; the server replays the moves to verify them and keeps them out of points/leaderboards.
4. **Online games.** Render only what the server sends (`game:updated`). Tapping a cell sends *intent*; the server may answer
   `NOT_YOUR_TURN`, `CELL_OCCUPIED`, `MOVE_CONFLICT`… – on `game:move-rejected` reload the state.
5. **Reconnection.** After the socket reconnects wait for `session:ready`; the server has already rejoined your games and replays the latest
   state (`game:updated` with `resumed: true`). `useOnlineGame` also re-fetches via REST. Resend un-acked moves with the same `clientMoveId`.
6. **Background/foreground.** On `AppState` → `active`, call `gameSocket.connect()` (no-op when connected) and `Games.active()` to resume.
7. **Push.** Request notification permission, get the FCM token (`@react-native-firebase/messaging`), call `Devices.register(token, Platform.OS)`
   after login and `Devices.remove(id)` on logout. Push is only sent when you have no live socket.
8. **Time.** Use `game.turnDeadline` / `serverTime` from the server for countdowns; don't trust the device clock.

## Example usage

```tsx
// App start
await tokenStorage.load();
setSessionExpiredHandler(() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }));
if (!tokenStorage.current()) await Auth.guest();
gameSocket.connect();
void syncOfflineMatches();

// Quick match screen
const { state, join, cancel } = useMatchmaking(3);
// state.phase: idle -> queued -> found(gameId) -> navigate('Game', { gameId })

// Game screen
const { game, myTurn, myMark, opponentOnline, play, error } = useOnlineGame(gameId, me.id);
<Board cells={game?.board} onPress={play} disabled={!myTurn} highlight={game?.result?.line} />
```
