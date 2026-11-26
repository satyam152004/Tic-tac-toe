import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BoardSize, Difficulty } from '../game-engine';
import type { EntryAmount, FirstMovePref } from '../services/api/types';

export type MainTabParamList = {
  HomeTab: undefined;
  FriendsTab: undefined;
  RankingTab: undefined;
  ProfileTab: undefined;
};

/**
 * One flat stack keeps navigation predictable (no cross-navigator params) and lets `navigate()` de-duplicate.
 * Route names are the original prototype ScreenIds. The four bottom-tab screens (home, friends,
 * leaderboard, user_profile) live in `Main`; use `useAppNav().goTab()` or `navigateToScreen()` to reach them.
 */
export type RootStackParamList = {
  splash: undefined;
  onboarding_1: undefined;
  onboarding_2: undefined;
  onboarding_3: undefined;
  welcome: undefined;
  login: undefined;
  registration: undefined;
  otp_verification: { email: string; purpose: 'verify' | 'reset' };
  forgot_password: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;

  // Game setup + offline
  match_setup:
    | { mode: 'LOCAL_2P' | 'VS_AI' }
    | { mode: 'ONLINE'; purpose: 'QUICK' }
    | { mode: 'ONLINE'; purpose: 'FRIEND' }
    | { mode: 'ONLINE'; purpose: 'CHALLENGE'; opponentId: string; opponentName: string };
  game_rules: undefined;
  offline_board: undefined; // the active local game lives in localGameStore
  game_result: undefined;
  rematch: undefined;
  offline_history: undefined;

  // Online
  online_lobby: undefined;
  matchmaking: { boardSize: BoardSize; firstMove: FirstMovePref; entryAmount?: EntryAmount };
  waiting_room: { roomId: string };
  online_board: { gameId: string };
  match_found:
    | { gameId: string; source: 'RANKED' | 'FRIEND' | 'ROOM'; opponentName?: string }
    | { source: 'COMPUTER' | 'PASS_N_PLAY' };
  create_room: undefined;
  join_room: { code?: string } | undefined;
  room_details: { roomId: string };
  online_result: { gameId: string };
  reconnection: { gameId?: string } | undefined;
  spectate_match: { gameId: string; friendName?: string };
  match_invitation: { gameId?: string; roomCode?: string; fromName?: string } | undefined;

  // Profile / social / progression / settings
  edit_profile: undefined;
  friend_profile: { userId: string; friendshipId?: string };
  game_statistics: undefined;
  achievements: undefined;
  daily_rewards: { openShop?: boolean } | undefined;
  settings: undefined;
  privacy_settings: undefined;
  theme_selection: undefined;
  notifications: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type TabKey = keyof MainTabParamList;

export const TAB_FOR_SCREEN = {
  home: 'HomeTab',
  friends: 'FriendsTab',
  leaderboard: 'RankingTab',
  user_profile: 'ProfileTab',
} as const;

export type { BoardSize, Difficulty };
