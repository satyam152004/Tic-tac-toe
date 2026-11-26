# Screen porting guide (prototype -> React Native)

Reference prototype (READ ONLY, never edit): `d:\Documents\tictactoe\frontend-prototype\src`
Target app: `d:\Documents\tictactoe\mobile` (Expo SDK 58, RN 0.88, React 19, strict TypeScript)
Backend (source of truth, READ ONLY): `d:\Documents\tictactoe\backend` (see `docs/API.md`, `docs/SOCKET_EVENTS.md`)

## What you are doing
Rebuild the assigned prototype screens as genuine React Native screens that look and behave like the prototype
(same layout, hierarchy, copy, spacing, colours) but are wired to the REAL app: real stores, real API, real offline engine.
No WebView, no mock data, no placeholder content, no fake opponents, no TODOs.

1. Read the prototype source for your screens (file names are in your assignment) AND `components/ds/DesignSystemComponents.tsx`
   (already ported to `src/components/*`, see below), `src/index.css` (tokens, already in `src/design-system`).
2. Translate Tailwind classes to `StyleSheet` styles using the design tokens. Pixel mapping: Tailwind `p-4`=16, `gap-3`=12,
   `rounded-2xl`=16, `rounded-3xl`=24, `text-[13px]`=13, etc.
3. Use `useThemedStyles((c) => ({...}))` or `useTheme()` for colours. NEVER hard-code theme colours (hex) except semantic ones that
   are identical in every theme in the prototype (e.g. `#F87171` danger text). Theme tokens: `bgPrimary bgSecondary bgCard bgElevated
   accent accentSecondary x o success warning danger text textSecondary border`.
4. Icons: `lucide-react-native` (the prototype uses `lucide-react`, same icon names). No emoji icons.
5. Every visible button/row/toggle must do something real. If the prototype's action has no real backend/engine equivalent, do the
   closest real thing (e.g. navigate) and say so in your report; do not leave dead buttons.
6. Every data screen needs real loading (`AppLoader` / skeleton), empty (`EmptyState`), error (`ErrorState` with retry) and offline
   states (`ErrorState offline`). Offline = a request failed with `ApiError.code === 'NETWORK_ERROR'`.
7. Accessibility: `accessibilityLabel` on icon-only buttons, 44pt minimum touch targets, `accessibilityRole`, keep text scalable (no fixed
   heights on text containers). Add `testID`s for primary actions/inputs (`testID="login-submit"`).
8. Lists: use `FlatList` for server lists; `Screen` (ScrollView) for static content. Screens inside the bottom tabs pass `tabs` to `Screen`.
9. Keep business logic out of the component: put non-trivial logic in hooks/services next to the screen or in `src/hooks`.
10. Never write secrets/tokens anywhere. Never call `Math.random()` for game outcomes of online games. Online results come ONLY from the server.

## Shared building blocks (already written; import, do not duplicate; do NOT edit them -- ask in your report if you need a change)
Components (`src/components`):
- `common/Screen` — themed safe-area wrapper: `<Screen title onBack rightAction scroll tabs padded footer>`; pass `title` to render the header
- `common/AppButton` (`title onPress variant="primary|secondary|outline|ghost|danger" size="md|lg" fullWidth icon loading disabled`)
- `common/AppCard` (`selected onPress padding="sm|md|lg"`), `AppHeader`, `AppIconButton`, `AppInput` (`label error hint leftIcon secureToggle`), `AppAvatar`
  (`avatarId name size="sm|md|lg|xl" status="online|in_game|offline" activeRing`), `AppModal`, `ConfirmDialog`, `Pressy`
- `feedback/AppLoader`, `feedback/StateViews` (`EmptyState`, `ErrorState`), toasts via `toast.success/error/warning/info(title, message?)` from `src/store/toastStore`
- `game/GameBoard` (`board size winningLine lastMoveIndex disabled compact onCellPress`, board cells are `'X'|'O'|''`), `game/SymbolMark`
- `navigation/AppTabBar` (used by the tab navigator, not by screens)
Design tokens: `src/design-system/{colors,typography,spacing,radius,shadows,themes}.ts`. Use `type.heading`, `type.body`, `type.small`, `type.num` etc.
Fonts are loaded by the app shell from `design-system/fonts.ts` (Plus Jakarta Sans for all text, JetBrains Mono for timers, scores and codes; regular / medium / semibold only). Use the `type` scale (or `<AppText variant>`) from `typography.ts`; do not set fontSize, fontFamily or fontWeight inline.

Navigation (`src/navigation`): flat native stack; route names == prototype ScreenIds. Types in `navigation/types.ts`
(`RootScreenProps<'online_board'>` gives typed `route.params`). Helpers: `const { nav, goTab, goHome, resetTo, back } = useAppNav()`.
Tabs: `goTab('HomeTab'|'FriendsTab'|'PlayTab'|'RankingTab'|'ProfileTab')`. Use `nav.navigate('screen_id', params)`; to replace use `nav.replace`.
Tab screens (home, game_mode, friends, leaderboard, user_profile) must be exported as normal components; `Screen tabs` for the bottom inset.
Android back button is handled by React Navigation; for screens that must confirm before leaving (active game) use `useBackGuard` (see below).

State (`src/store`, zustand): `useAuthStore` (user: `Me`, status, `useIsGuest()`), `useSettingsStore` (theme, soundEffects, vibration,
notifications, language, `set(patch)`), `useLocalGameStore` (offline game: `setup`, `configure`, `start`, `play`, `aiMove`, `undoMove`, `rematch`, `pause`,
`unpause`, `quit`, `game`, `paused`, `lastMove`, `historyVersion`, plus `seatsOf(setup)`), `useOnlineStore` (online game/matchmaking/room state fed by the socket),
`useToastStore`. Online intents live in `src/services/onlineActions.ts` (`startQuickMatch`, `cancelQuickMatch`, `createRoom`, `joinRoomByCode`, `setReady`,
`startRoomGame`, `leaveRoom`, `submitMove`, `forfeitGame`, `requestRematch`, `joinGame`, `openGame`).
Server state hooks (`src/hooks/queries.ts`, TanStack Query): `useMe, usePublicProfile, useStats, useStreaks, useHistory, useLeaderboard, useFriends, useBlocked,
useAchievements, useDailyReward, useNotifications, useReplay, useUpdateProfile, useClaimDailyReward, useFriendActions`.
Raw API modules: `src/services/api/*` (`authApi`, `userApi`, `gameApi`, `roomApi`, `matchmakingApi`, `friendApi`, `leaderboardApi`, `statisticsApi`,
`achievementApi`, `notificationApi`, `rewardApi`); types in `src/services/api/types.ts`. Error helper: `friendlyMessage(err)`, `toApiError(err)`.
Offline engine: `src/game-engine` (BoardSize 3|4|5; Difficulty `EASY|MEDIUM|HARD|EXPERT|IMPOSSIBLE`). Offline history: `src/services/storage/localGameStorage.ts`.
Sound/haptics: `src/services/feedback.ts` (`feedback.tap()`, etc.).
Avatars: `src/constants/avatars.ts` (`AVATAR_PRESETS`, `SELECTABLE_AVATARS`, `findAvatar`, `ONBOARDING_IMAGES`).

## Data mapping (prototype mock model -> real backend)
- `coins` -> `Me.wallet.coins` (only changed by the server via daily rewards). `rating` -> `Me.stats.points`. `level/xp` -> `Me.stats.level/xp`; progress in level =
  `(xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)`. `wins/losses/draws/streak` -> `Me.stats.*`. `bio` -> `Me.bio`. `username` -> `Me.displayName`
  for display (unique handle is `Me.username`). `avatarId` -> `Me.avatar` (preset id like `av_1`; default value from the server `avatar_default` falls back to `av_1`).
- Friends -> `FriendItem` (`friendshipId`, `user: PlayerCard`). Presence from `user.online`. Leaderboard -> `LeaderboardRow` (`points` is the rating). `winRate` = `wins/games`.
- Achievements -> `AchievementItem` (`name`, `reward {xp, points}`; there are NO coin rewards for achievements, show XP). Daily rewards -> `DailyRewardStatus` (day-7 has no bonus item).
- Board sizes 3/4/5 only (the prototype's 5 and 6 become 4 and 5). Prototype `Difficulty` easy/medium/hard becomes the five backend levels.
- Online results are authoritative: show `game.result`, `game.players[].outcome/pointsAwarded` from the server, never compute winners on the client for online games.
- Guests (`Me.accountType === 'GUEST'`) can play everything; show an "upgrade account" prompt where the prototype shows account-only features.

## Rules of the road
- You may create new files under your assigned `src/screens/<group>/` folders, plus new hooks under `src/hooks/` and tests under `tests/`. Do NOT modify shared
  files (components, stores, services, navigation, design-system); if you need a change, make the smallest local workaround and list it in your report.
- Export each screen as a named export `XxxScreen` from its own file (names are in your assignment). Screens receive `RootScreenProps<'route_name'>` props.
- Run `npx tsc --noEmit` from `d:\Documents\tictactoe\mobile` until your files have zero type errors (errors in other agents' files may appear while they work: ignore them).
- Write RNTL tests (`@testing-library/react-native` v14: `await render(...)`, `await fireEvent.press(...)`, `await screen.findBy...`) for your screens under
  `tests/screens/<group>.test.tsx`: renders, the primary interactions, loading/empty/error states, form validation. Mock the API modules with `jest.mock`.
  Run only your tests: `npx jest tests/screens/<group>` and make them pass. A global test setup (`tests/setup.ts`) already mocks native modules.
  Wrap screens that use navigation in `NavigationContainer` + a stack, or mock `useAppNav`/`useNavigation`. Wrap query hooks in a `QueryClientProvider`.
- Do not claim anything you did not run. Report: files created, what each screen does, backend endpoints/events used, tests run + results, anything you could not do.
