import React from 'react';
import { ShieldAlert, WifiOff } from 'lucide-react';
import {
  AppButton,
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  LoadingIndicator,
} from '../components/ds/DesignSystemComponents';
import { CoreScreens } from './CoreScreens';
import { OfflineScreens } from './OfflineScreens';
import { OnlineScreens } from './OnlineScreens';
import { AuthProfileScreens } from './AuthProfileScreens';
import { SocialProgressionScreens } from './SocialProgressionScreens';
import { SettingsThemeScreens } from './SettingsThemeScreens';
import {
  Achievement,
  ActiveGameSession,
  BoardSize,
  DailyReward,
  Difficulty,
  Friend,
  LeaderboardEntry,
  MatchRecord,
  PlayerProfile,
  RoomInfo,
  ScreenId,
  ThemeId,
  UIStateOverride,
} from '../types/app';
import { SCREEN_CATALOG } from '../data/mockData';

export interface MobileScreenRouterProps {
  screen: ScreenId;
  uiState: UIStateOverride;
  user: PlayerProfile;
  session: ActiveGameSession;
  setupConfig: {
    p1Name: string;
    p1Avatar: string;
    p1Symbol: 'X' | 'O';
    p2Name: string;
    p2Avatar: string;
    boardSize: BoardSize;
  };
  selectedDifficulty: Difficulty;
  selectedBoardSize: BoardSize;
  history: MatchRecord[];
  room: RoomInfo;
  friends: Friend[];
  selectedFriend: Friend;
  leaderboard: LeaderboardEntry[];
  achievements: Achievement[];
  rewards: DailyReward[];
  activeTheme: ThemeId;
  settings: {
    soundEffects: boolean;
    music: boolean;
    vibration: boolean;
    notifications: boolean;
    language: string;
  };
  onResetUIState: () => void;
  onUpdateSetup: (patch: Partial<MobileScreenRouterProps['setupConfig']>) => void;
  onNavigate: (screen: ScreenId) => void;
  onBack: () => void;
  onStartLocalGame: () => void;
  onPlayAsGuest: () => void;
  onCellPress: (index: number) => void;
  onUndo: () => void;
  onRestartRound: () => void;
  onSelectDifficulty: (d: Difficulty) => void;
  onStartVsAI: (d?: Difficulty) => void;
  onSelectBoardSize: (size: BoardSize) => void;
  onStartQuickMatch: () => void;
  onCreateRoom: (size: BoardSize) => void;
  onJoinRoomCode: (code: string) => boolean;
  onToggleMute: () => void;
  onUpdateProfile: (patch: Partial<PlayerProfile>) => void;
  onSelectFriend: (f: Friend) => void;
  onAcceptFriendRequest: (id: string) => void;
  onAddFriend: (username: string) => void;
  onClaimReward: (day: number) => void;
  onChallengeFriend: (f: Friend) => void;
  onUpdateSettings: (patch: Partial<MobileScreenRouterProps['settings']>) => void;
  onSelectTheme: (theme: ThemeId) => void;
  onNotify: (title: string, message?: string) => void;
}

export const MobileScreenRouter: React.FC<MobileScreenRouterProps> = (props) => {
  const meta = SCREEN_CATALOG.find((s) => s.id === props.screen);

  /* Global UI Edge State Simulator */
  if (props.uiState !== 'default') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title={meta?.title || 'Screen'} onBack={props.onResetUIState} />
        <div className="flex-1 flex flex-col justify-center p-5">
          {props.uiState === 'loading' && (
            <LoadingIndicator
              label="Syncing Game Data"
              sublabel="Fetching latest arena state..."
            />
          )}
          {props.uiState === 'empty' && (
            <EmptyState
              title="No Items Available"
              description="There are no records to display in this view right now."
              actionLabel="Restore Default View"
              onAction={props.onResetUIState}
            />
          )}
          {props.uiState === 'error' && (
            <ErrorState
              title="Unable to Load Data"
              message="A temporary server error occurred while syncing your request."
              retryLabel="Retry Request"
              onRetry={props.onResetUIState}
            />
          )}
          {props.uiState === 'offline' && (
            <ErrorState
              offline
              title="No Internet Connection"
              message="You are currently offline. Local AI and Pass & Play remain available."
              retryLabel="Play Offline Instead"
              onRetry={() => {
                props.onResetUIState();
                props.onNavigate('player_setup');
              }}
            />
          )}
          {props.uiState === 'opponent_disconnected' && (
            <AppCard padding="lg" className="text-center space-y-4 border-[#FBBF24]/50">
              <div className="w-12 h-12 rounded-2xl bg-[#FBBF24]/15 text-[#FBBF24] flex items-center justify-center mx-auto">
                <WifiOff className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                  Opponent Disconnected
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Waiting 30s for MayaLin to reconnect before awarding forfeit victory.
                </p>
              </div>
              <AppButton fullWidth size="md" onClick={props.onResetUIState}>
                Resume Match
              </AppButton>
            </AppCard>
          )}
          {props.uiState === 'permission_denied' && (
            <AppCard padding="lg" className="text-center space-y-4 border-[#EF4444]/40">
              <div className="w-12 h-12 rounded-2xl bg-[#EF4444]/15 text-[#F87171] flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-[var(--text-primary)]">
                  Notifications Permission Denied
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Enable system notifications in device settings to receive friend match invites.
                </p>
              </div>
              <AppButton fullWidth size="md" variant="secondary" onClick={props.onResetUIState}>
                Back to Screen
              </AppButton>
            </AppCard>
          )}
        </div>
      </div>
    );
  }

  const num = meta?.number || 1;

  if (num >= 1 && num <= 9) {
    return (
      <CoreScreens
        screen={props.screen}
        user={props.user}
        setupConfig={props.setupConfig}
        onUpdateSetup={props.onUpdateSetup}
        onNavigate={props.onNavigate}
        onBack={props.onBack}
        onStartLocalGame={props.onStartLocalGame}
        onPlayAsGuest={props.onPlayAsGuest}
        onNotify={props.onNotify}
      />
    );
  }

  if (num >= 10 && num <= 16) {
    return (
      <OfflineScreens
        screen={props.screen}
        session={props.session}
        selectedDifficulty={props.selectedDifficulty}
        selectedBoardSize={props.selectedBoardSize}
        history={props.history}
        onCellPress={props.onCellPress}
        onUndo={props.onUndo}
        onRestartRound={props.onRestartRound}
        onSelectDifficulty={props.onSelectDifficulty}
        onStartVsAI={props.onStartVsAI}
        onSelectBoardSize={props.onSelectBoardSize}
        onNavigate={props.onNavigate}
        onBack={props.onBack}
      />
    );
  }

  if (num >= 17 && num <= 26) {
    return (
      <OnlineScreens
        screen={props.screen}
        user={props.user}
        session={props.session}
        room={props.room}
        friends={props.friends}
        onCellPress={props.onCellPress}
        onStartQuickMatch={props.onStartQuickMatch}
        onCreateRoom={props.onCreateRoom}
        onJoinRoomCode={props.onJoinRoomCode}
        onToggleMute={props.onToggleMute}
        onNavigate={props.onNavigate}
        onBack={props.onBack}
        onNotify={props.onNotify}
      />
    );
  }

  if (num >= 27 && num <= 32) {
    return (
      <AuthProfileScreens
        screen={props.screen}
        user={props.user}
        onUpdateProfile={props.onUpdateProfile}
        onNavigate={props.onNavigate}
        onBack={props.onBack}
        onNotify={props.onNotify}
      />
    );
  }

  if (num >= 33 && num <= 38) {
    return (
      <SocialProgressionScreens
        screen={props.screen}
        user={props.user}
        leaderboard={props.leaderboard}
        friends={props.friends}
        selectedFriend={props.selectedFriend}
        achievements={props.achievements}
        rewards={props.rewards}
        onSelectFriend={props.onSelectFriend}
        onAcceptFriendRequest={props.onAcceptFriendRequest}
        onAddFriend={props.onAddFriend}
        onClaimReward={props.onClaimReward}
        onChallengeFriend={props.onChallengeFriend}
        onNavigate={props.onNavigate}
        onBack={props.onBack}
        onNotify={props.onNotify}
      />
    );
  }

  return (
    <SettingsThemeScreens
      screen={props.screen}
      activeTheme={props.activeTheme}
      settings={props.settings}
      onUpdateSettings={props.onUpdateSettings}
      onSelectTheme={props.onSelectTheme}
      onNavigate={props.onNavigate}
      onBack={props.onBack}
      onNotify={props.onNotify}
    />
  );
};
