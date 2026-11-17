export type Platform = 'ios' | 'android';

export type ThemeId = 'dark' | 'light' | 'classic' | 'neon' | 'ocean' | 'sunset';

export type BoardSize = 3 | 5 | 6;

export type Difficulty = 'easy' | 'medium' | 'hard';

export type GameModeType = 'ai' | 'local' | 'online_quick' | 'online_private' | 'online_friend';

export type CellValue = 'X' | 'O' | null;

export type UIStateOverride =
  | 'default'
  | 'loading'
  | 'empty'
  | 'error'
  | 'offline'
  | 'opponent_disconnected'
  | 'permission_denied';

export type ScreenId =
  | 'splash'
  | 'onboarding_1'
  | 'onboarding_2'
  | 'onboarding_3'
  | 'welcome'
  | 'home'
  | 'game_mode'
  | 'player_setup'
  | 'game_rules'
  | 'offline_board'
  | 'board_selection'
  | 'ai_difficulty'
  | 'game_pause'
  | 'game_result'
  | 'rematch'
  | 'offline_history'
  | 'online_lobby'
  | 'matchmaking'
  | 'waiting_room'
  | 'online_board'
  | 'create_room'
  | 'join_room'
  | 'room_details'
  | 'online_result'
  | 'reconnection'
  | 'match_invitation'
  | 'login'
  | 'registration'
  | 'otp_verification'
  | 'forgot_password'
  | 'user_profile'
  | 'edit_profile'
  | 'leaderboard'
  | 'friends'
  | 'friend_profile'
  | 'game_statistics'
  | 'achievements'
  | 'daily_rewards'
  | 'settings'
  | 'theme_selection';

export type ScreenCategory =
  | 'Onboarding & Core'
  | 'Offline Game'
  | 'Online Multiplayer'
  | 'Auth & Profile'
  | 'Social & Progression'
  | 'Settings & Themes';

export interface ScreenMeta {
  number: number;
  id: ScreenId;
  title: string;
  category: ScreenCategory;
  summary: string;
  components: string[];
  nextScreens: ScreenId[];
}

export interface PlayerProfile {
  id: string;
  username: string;
  bio: string;
  avatarId: string;
  level: number;
  xp: number;
  xpMax: number;
  coins: number;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  isGuest: boolean;
}

export interface MatchRecord {
  id: string;
  opponentName: string;
  opponentAvatarId: string;
  mode: 'AI Easy' | 'AI Medium' | 'AI Hard' | 'Local 2P' | 'Online Ranked' | 'Private Room';
  boardSize: BoardSize;
  result: 'win' | 'loss' | 'draw';
  scoreSummary: string;
  date: string;
  duration: string;
  movesCount: number;
}

export interface Friend {
  id: string;
  username: string;
  avatarId: string;
  level: number;
  rating: number;
  status: 'online' | 'in_game' | 'offline';
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  pendingRequest?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  avatarId: string;
  wins: number;
  rating: number;
  winRate: number;
  isCurrentUser?: boolean;
  isFriend?: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'Strategy' | 'Multiplayer' | 'Milestones';
  progress: number;
  target: number;
  rewardCoins: number;
  unlocked: boolean;
}

export interface DailyReward {
  day: number;
  coins: number;
  bonusLabel?: string;
  status: 'claimed' | 'claimable' | 'locked';
}

export interface RoomInfo {
  code: string;
  hostName: string;
  hostAvatarId: string;
  boardSize: BoardSize;
  winLength: number;
  guestName: string | null;
  guestAvatarId: string | null;
  guestReady: boolean;
}

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

export interface ActiveGameSession {
  mode: GameModeType;
  boardSize: BoardSize;
  difficulty: Difficulty;
  player1Name: string;
  player1Avatar: string;
  player1Symbol: 'X' | 'O';
  player2Name: string;
  player2Avatar: string;
  player2Symbol: 'X' | 'O';
  board: CellValue[];
  moveHistory: number[];
  currentTurn: 'X' | 'O';
  winner: 'X' | 'O' | 'draw' | null;
  winningLine: number[] | null;
  scores: { p1: number; p2: number; draws: number };
  elapsedSeconds: number;
  isMuted: boolean;
}
