import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Bot,
  ChevronRight,
  Coins,
  Cpu,
  Gift,
  Globe,
  Grid3X3,
  History,
  Mail,
  Play,
  Settings,
  Shield,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  AppButton,
  AppCard,
  AppHeader,
  BottomNavigation,
  GameBoard,
  GameModeCard,
  LoadingIndicator,
  PlayerAvatar,
  ScoreCard,
  SymbolMark,
} from '../components/ds/DesignSystemComponents';
import { AVATAR_PRESETS, GENERATED_ASSETS } from '../data/mockData';
import { BoardSize, PlayerProfile, ScreenId } from '../types/app';

export interface CoreScreensProps {
  screen: ScreenId;
  user: PlayerProfile;
  setupConfig: {
    p1Name: string;
    p1Avatar: string;
    p1Symbol: 'X' | 'O';
    p2Name: string;
    p2Avatar: string;
    boardSize: BoardSize;
  };
  onUpdateSetup: (patch: Partial<CoreScreensProps['setupConfig']>) => void;
  onNavigate: (screen: ScreenId) => void;
  onBack: () => void;
  onStartLocalGame: () => void;
  onPlayAsGuest: () => void;
  onNotify: (title: string, message?: string) => void;
}

const IllustrationFrame: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);

  return (
    <div className="w-full aspect-[4/3] rounded-3xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-card)] relative">
      {!failed ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#8B5CF6]/20 via-[#15102A] to-[#38BDF8]/15 p-6 text-center">
          <div className="flex items-center gap-4 mb-3">
            <SymbolMark value="X" size="xl" />
            <SymbolMark value="O" size="xl" />
          </div>
          <span className="text-xs text-[var(--text-secondary)]">{alt}</span>
        </div>
      )}
    </div>
  );
};

export const CoreScreens: React.FC<CoreScreensProps> = ({
  screen,
  user,
  setupConfig,
  onUpdateSetup,
  onNavigate,
  onBack,
  onStartLocalGame,
  onPlayAsGuest,
  onNotify,
}) => {
  /* 1. Splash Screen */
  if (screen === 'splash') {
    return (
      <div className="flex-1 flex flex-col items-center justify-between px-6 py-12 bg-gradient-to-b from-[#15102A] via-[#0B0718] to-[#0B0718] text-center">
        <div className="h-4" />
        <div className="space-y-6">
          <div className="w-28 h-28 mx-auto rounded-3xl bg-[var(--bg-card)] border border-[#8B5CF6]/50 flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(139,92,246,0.28)]">
            <SymbolMark value="X" size="lg" />
            <SymbolMark value="O" size="lg" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-3xl tracking-tight text-white">
              Tic Tac Toe
            </h1>
            <p className="text-sm text-[#A8A0BC] mt-1.5">
              Strategic Offline &amp; Online Arena
            </p>
          </div>
        </div>

        <div className="w-full space-y-5">
          <LoadingIndicator label="Preparing Arena" sublabel="Syncing boards & rankings" />
          <AppButton fullWidth onClick={() => onNavigate('onboarding_1')}>
            Continue
          </AppButton>
        </div>
      </div>
    );
  }

  /* 2, 3, 4. Onboarding Screens 1-3 */
  if (screen === 'onboarding_1' || screen === 'onboarding_2' || screen === 'onboarding_3') {
    const step = screen === 'onboarding_1' ? 1 : screen === 'onboarding_2' ? 2 : 3;
    const content = {
      1: {
        img: GENERATED_ASSETS.onboardingClassic,
        alt: 'Isometric glowing Tic Tac Toe crystal game board',
        title: 'Classic Strategy, Reimagined',
        desc: 'Master 3x3 classics or expand into 5x5 and 6x6 tactical grids with crisp turn feedback.',
        cta: 'Next',
        next: 'onboarding_2' as ScreenId,
      },
      2: {
        img: GENERATED_ASSETS.onboardingAi,
        alt: 'Tactical AI strategist analyzing strategy grid',
        title: 'Offline Duels & Smart AI',
        desc: 'Play pass-and-play with a friend anywhere or challenge Easy, Medium, and Hard AI.',
        cta: 'Next',
        next: 'onboarding_3' as ScreenId,
      },
      3: {
        img: GENERATED_ASSETS.onboardingOnline,
        alt: 'Two competitive player crests connected in online arena',
        title: 'Compete Online Worldwide',
        desc: 'Join instant quick matches, create private friend rooms, and climb global leaderboards.',
        cta: 'Get Started',
        next: 'welcome' as ScreenId,
      },
    }[step];

    return (
      <div className="flex-1 flex flex-col justify-between p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-secondary)] font-mono-num">
            {step} / 3
          </span>
          <button
            type="button"
            onClick={() => onNavigate('welcome')}
            className="min-h-[44px] px-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            Skip
          </button>
        </div>

        <div className="space-y-6 my-auto">
          <IllustrationFrame src={content.img} alt={content.alt} />
          <div className="space-y-2.5 text-center px-2">
            <h2 className="font-display font-bold text-2xl text-[var(--text-primary)]">
              {content.title}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{content.desc}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((dot) => (
              <button
                key={dot}
                type="button"
                aria-label={`Onboarding step ${dot}`}
                onClick={() =>
                  onNavigate(
                    dot === 1 ? 'onboarding_1' : dot === 2 ? 'onboarding_2' : 'onboarding_3'
                  )
                }
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  dot === step ? 'w-7 bg-[#8B5CF6]' : 'w-2 bg-[var(--border-color)]'
                }`}
              />
            ))}
          </div>
          <AppButton fullWidth onClick={() => onNavigate(content.next)}>
            {content.cta}
          </AppButton>
        </div>
      </div>
    );
  }

  /* 5. Welcome Screen */
  if (screen === 'welcome') {
    return (
      <div className="flex-1 flex flex-col justify-between p-5">
        <div className="pt-6 text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center gap-1.5">
            <SymbolMark value="X" size="md" />
            <SymbolMark value="O" size="md" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-[var(--text-primary)]">
              Welcome to Tic Tac Toe
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Sign in to sync rankings, friends, and rewards.
            </p>
          </div>
        </div>

        <div className="space-y-3 my-auto py-6">
          <AppButton
            fullWidth
            variant="secondary"
            icon={<Globe className="w-4 h-4 text-[#38BDF8]" />}
            onClick={() => {
              onNotify('Google Sign-In', 'Authenticated as AidenVance');
              onNavigate('home');
            }}
          >
            Continue with Google
          </AppButton>
          <AppButton
            fullWidth
            variant="secondary"
            icon={<Shield className="w-4 h-4 text-[var(--text-primary)]" />}
            onClick={() => {
              onNotify('Apple Sign-In', 'Authenticated with Apple ID');
              onNavigate('home');
            }}
          >
            Continue with Apple
          </AppButton>
          <AppButton
            fullWidth
            variant="primary"
            icon={<Mail className="w-4 h-4" />}
            onClick={() => onNavigate('login')}
          >
            Sign in with Email
          </AppButton>

          <div className="relative py-2 flex items-center">
            <div className="flex-1 border-t border-[var(--border-color)]" />
            <span className="px-3 text-xs text-[var(--text-secondary)]">or</span>
            <div className="flex-1 border-t border-[var(--border-color)]" />
          </div>

          <AppButton fullWidth variant="outline" onClick={onPlayAsGuest}>
            Play as Guest
          </AppButton>
        </div>

        <p className="text-[11px] text-center text-[var(--text-secondary)]">
          New player?{' '}
          <button
            type="button"
            onClick={() => onNavigate('registration')}
            className="text-[#8B5CF6] font-semibold hover:underline cursor-pointer"
          >
            Create an account
          </button>
        </p>
      </div>
    );
  }

  /* 6. Home Screen */
  if (screen === 'home') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          {/* Top Player Summary Row */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onNavigate('user_profile')}
              className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
            >
              <PlayerAvatar avatarId={user.avatarId} name={user.username} size="md" status="online" />
              <div className="min-w-0">
                <div className="font-display font-bold text-[16px] text-[var(--text-primary)] truncate">
                  {user.username}
                </div>
                <div className="text-[12px] text-[var(--text-secondary)] font-mono-num">
                  Level {user.level} · {user.rating} pts
                </div>
              </div>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('daily_rewards')}
                className="min-h-[44px] px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center gap-1.5 cursor-pointer hover:border-[#FBBF24]/60"
              >
                <Coins className="w-4 h-4 text-[#FBBF24]" />
                <span className="font-mono-num font-bold text-[13px] text-[var(--text-primary)]">
                  {user.coins}
                </span>
              </button>
              <button
                type="button"
                aria-label="Settings"
                onClick={() => onNavigate('settings')}
                className="w-11 h-11 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Primary Play Hero Card */}
          <div className="rounded-3xl p-5 bg-gradient-to-br from-[#8B5CF6]/25 via-[#1C1635] to-[#15102A] border border-[#8B5CF6]/50 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-xl text-[var(--text-primary)]">
                  Ready to Play
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Win streak {user.streak} · Classic 3x3 &amp; Tactical 5x5
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <SymbolMark value="X" size="md" />
                <SymbolMark value="O" size="md" />
              </div>
            </div>
            <AppButton
              fullWidth
              icon={<Play className="w-4 h-4 fill-current" />}
              onClick={() => onNavigate('game_mode')}
            >
              Play Game
            </AppButton>
          </div>

          {/* Core Mode Cards */}
          <div className="space-y-2.5">
            <h3 className="font-display font-semibold text-[14px] text-[var(--text-secondary)]">
              Game Modes
            </h3>
            <GameModeCard
              title="Offline Game"
              description="Play vs AI or pass-and-play locally"
              metaText="3x3, 5x5 & 6x6 · No internet needed"
              icon={<Cpu className="w-5 h-5" />}
              onClick={() => onNavigate('player_setup')}
            />
            <GameModeCard
              title="Online Multiplayer"
              description="Quick Match, Private Rooms & Friends"
              metaText="1,240 players active · Ranked"
              icon={<Globe className="w-5 h-5" />}
              featured
              onClick={() => onNavigate('online_lobby')}
            />
          </div>

          {/* 4-Shortcut Action Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <AppCard onClick={() => onNavigate('leaderboard')} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FBBF24]/15 text-[#FBBF24] flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-semibold text-[13px] text-[var(--text-primary)]">
                  Leaderboard
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">Global Rank #5</div>
              </div>
            </AppCard>

            <AppCard onClick={() => onNavigate('friends')} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#38BDF8]/15 text-[#38BDF8] flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-semibold text-[13px] text-[var(--text-primary)]">
                  Friends
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">3 Online Now</div>
              </div>
            </AppCard>

            <AppCard onClick={() => onNavigate('daily_rewards')} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F472B6]/15 text-[#F472B6] flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-semibold text-[13px] text-[var(--text-primary)]">
                  Rewards
                </div>
                <div className="text-[11px] text-[#22C55E]">Day 3 Ready</div>
              </div>
            </AppCard>

            <AppCard onClick={() => onNavigate('achievements')} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-semibold text-[13px] text-[var(--text-primary)]">
                  Achievements
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">2 / 6 Unlocked</div>
              </div>
            </AppCard>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pb-1">
            <ScoreCard label="Total Wins" value={user.wins} tone="success" />
            <ScoreCard
              label="Match History"
              value={user.wins + user.losses + user.draws}
              subtext="View log"
            />
          </div>
          <AppButton
            fullWidth
            variant="ghost"
            size="md"
            icon={<History className="w-4 h-4" />}
            onClick={() => onNavigate('offline_history')}
          >
            View Offline Match History
          </AppButton>
        </div>

        <BottomNavigation activeTab="home" onNavigate={onNavigate} />
      </div>
    );
  }

  /* 7. Game Mode Screen */
  if (screen === 'game_mode') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader
          title="Select Game Mode"
          onBack={onBack}
          rightAction={
            <button
              type="button"
              aria-label="Game rules"
              onClick={() => onNavigate('game_rules')}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <BookOpen className="w-5 h-5" />
            </button>
          }
        />

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
          <GameModeCard
            title="Player vs AI"
            description="Challenge Easy, Medium, or Hard adaptive bots"
            metaText="Single-player · Practice & Ranked"
            icon={<Bot className="w-6 h-6" />}
            featured
            onClick={() => onNavigate('ai_difficulty')}
          />

          <GameModeCard
            title="Offline Pass & Play"
            description="Two players on one device with custom names"
            metaText="Local 2P · 3x3, 5x5 & 6x6 boards"
            icon={<Users className="w-6 h-6" />}
            onClick={() => onNavigate('player_setup')}
          />

          <GameModeCard
            title="Online Multiplayer"
            description="Random matchmaking against global players"
            metaText="Real-time · Earn rating & coins"
            icon={<Globe className="w-6 h-6" />}
            onClick={() => onNavigate('online_lobby')}
          />

          <GameModeCard
            title="Play with Friends"
            description="Create a private room code and invite friends"
            metaText="Custom board size · Instant invite"
            icon={<UserCheck className="w-6 h-6" />}
            onClick={() => onNavigate('create_room')}
          />

          <AppCard onClick={() => onNavigate('board_selection')} className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              <Grid3X3 className="w-5 h-5 text-[#38BDF8]" />
              <div>
                <div className="font-display font-semibold text-sm text-[var(--text-primary)]">
                  Advanced Board Sizes
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Preview 3x3, 5x5 &amp; 6x6 winning rules
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
          </AppCard>
        </div>

        <BottomNavigation activeTab="play" onNavigate={onNavigate} />
      </div>
    );
  }

  /* 8. Player Setup Screen */
  if (screen === 'player_setup') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader
          title="Player Setup"
          subtitle="Offline 2-Player Match"
          onBack={onBack}
          rightAction={
            <button
              type="button"
              onClick={() => onNavigate('game_rules')}
              className="text-xs font-semibold text-[#8B5CF6] px-2 min-h-[44px] cursor-pointer"
            >
              Rules
            </button>
          }
        />

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          {/* Player 1 */}
          <AppCard className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Player 1</span>
              <div className="flex items-center gap-1.5">
                {(['X', 'O'] as const).map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => onUpdateSetup({ p1Symbol: sym })}
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer ${
                      setupConfig.p1Symbol === sym
                        ? 'border-[#8B5CF6] bg-[#8B5CF6]/20'
                        : 'border-[var(--border-color)] bg-[var(--bg-secondary)] opacity-60'
                    }`}
                  >
                    <SymbolMark value={sym} size="sm" glow={setupConfig.p1Symbol === sym} />
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              value={setupConfig.p1Name}
              onChange={(e) => onUpdateSetup({ p1Name: e.target.value })}
              placeholder="Player 1 name"
              className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#8B5CF6]"
            />

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
              {AVATAR_PRESETS.slice(0, 5).map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => onUpdateSetup({ p1Avatar: av.id })}
                  className="cursor-pointer rounded-2xl p-0.5"
                >
                  <PlayerAvatar
                    avatarId={av.id}
                    size="sm"
                    activeRing={setupConfig.p1Avatar === av.id}
                  />
                </button>
              ))}
            </div>
          </AppCard>

          {/* Player 2 */}
          <AppCard className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Player 2</span>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>Assigned:</span>
                <SymbolMark value={setupConfig.p1Symbol === 'X' ? 'O' : 'X'} size="sm" />
              </div>
            </div>

            <input
              type="text"
              value={setupConfig.p2Name}
              onChange={(e) => onUpdateSetup({ p2Name: e.target.value })}
              placeholder="Player 2 name"
              className="w-full h-11 px-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#8B5CF6]"
            />

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
              {AVATAR_PRESETS.slice(0, 5).map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => onUpdateSetup({ p2Avatar: av.id })}
                  className="cursor-pointer rounded-2xl p-0.5"
                >
                  <PlayerAvatar
                    avatarId={av.id}
                    size="sm"
                    activeRing={setupConfig.p2Avatar === av.id}
                  />
                </button>
              ))}
            </div>
          </AppCard>

          {/* Board Size */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--text-secondary)]">Board Size</div>
            <div className="grid grid-cols-3 gap-2.5">
              {([3, 5, 6] as BoardSize[]).map((sz) => (
                <AppCard
                  key={sz}
                  selected={setupConfig.boardSize === sz}
                  onClick={() => onUpdateSetup({ boardSize: sz })}
                  padding="sm"
                  className="text-center"
                >
                  <div className="font-display font-bold text-base text-[var(--text-primary)] font-mono-num">
                    {sz}x{sz}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    {sz === 3 ? '3 in a row' : '4 in a row'}
                  </div>
                </AppCard>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border-color)]/60 bg-[var(--bg-primary)]">
          <AppButton fullWidth onClick={onStartLocalGame}>
            Start Game
          </AppButton>
        </div>
      </div>
    );
  }

  /* 9. Game Rules Screen */
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AppHeader title="Game Rules" onBack={onBack} />
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        <AppCard className="space-y-3">
          <h3 className="font-display font-bold text-[15px] text-[var(--text-primary)]">
            Example Winning Board
          </h3>
          <GameBoard
            size={3}
            board={['X', 'O', null, null, 'X', 'O', null, null, 'X']}
            winningLine={[0, 4, 8]}
            disabled
          />
          <p className="text-xs text-center text-[var(--text-secondary)]">
            Align matching symbols horizontally, vertically, or diagonally.
          </p>
        </AppCard>

        <AppCard className="space-y-2.5">
          <h4 className="font-display font-semibold text-sm text-[var(--text-primary)]">
            Winning Combinations
          </h4>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed">
            <li>• Classic 3x3 Grid: First player to align 3 symbols wins the round.</li>
            <li>• Tactical 5x5 &amp; 6x6 Grids: Align 4 consecutive symbols in any direction.</li>
            <li>• Turn Order: X always opens the round unless symbols are swapped on rematch.</li>
            <li>• Draw Rule: If all cells fill without a line, both players split points.</li>
          </ul>
        </AppCard>
      </div>

      <div className="p-4 border-t border-[var(--border-color)]/60">
        <AppButton fullWidth onClick={onStartLocalGame}>
          Continue to Match
        </AppButton>
      </div>
    </div>
  );
};
