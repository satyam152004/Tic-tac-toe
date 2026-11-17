import React from 'react';
import {
  AlertTriangle,
  Award,
  Battery,
  Check,
  CheckCircle2,
  ChevronLeft,
  Coins,
  Gamepad2,
  Home,
  Info,
  Lock,
  Signal,
  Trophy,
  User,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  Achievement,
  BoardSize,
  CellValue,
  DailyReward,
  LeaderboardEntry,
  Platform,
  ScreenId,
  ToastData,
} from '../../types/app';
import { AVATAR_PRESETS, ThemeDefinition } from '../../data/mockData';

/* -------------------------------------------------------------------------- */
/* Platform System Chrome (iOS Dynamic Island vs Android Material Status Bar)  */
/* -------------------------------------------------------------------------- */

export const PlatformStatusBar: React.FC<{ platform: Platform }> = ({ platform }) => {
  if (platform === 'ios') {
    return (
      <div className="h-11 px-6 flex items-center justify-between text-[12px] font-semibold select-none shrink-0 text-[var(--text-primary)]">
        <span className="font-mono-num w-12">9:41</span>
        <div className="w-24 h-6 rounded-full bg-black border border-white/10 flex items-center justify-end pr-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1a1530] ring-1 ring-white/15" />
        </div>
        <div className="flex items-center gap-1.5 w-14 justify-end">
          <Signal className="w-3.5 h-3.5" />
          <Wifi className="w-3.5 h-3.5" />
          <Battery className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-9 px-5 flex items-center justify-between text-[11px] font-medium select-none shrink-0 text-[var(--text-primary)]">
      <div className="flex items-center gap-2">
        <span className="font-mono-num">9:41</span>
      </div>
      <div className="w-3.5 h-3.5 rounded-full bg-black border border-white/15" />
      <div className="flex items-center gap-1.5">
        <Signal className="w-3.5 h-3.5" />
        <Wifi className="w-3.5 h-3.5" />
        <span className="font-mono-num text-[10px]">94%</span>
      </div>
    </div>
  );
};

export const PlatformNavIndicator: React.FC<{
  platform: Platform;
  onBack?: () => void;
  onHome?: () => void;
}> = ({ platform, onBack, onHome }) => {
  if (platform === 'ios') {
    return (
      <div className="h-5 flex items-center justify-center shrink-0">
        <div className="w-32 h-1 rounded-full bg-[var(--text-primary)] opacity-25" />
      </div>
    );
  }
  return (
    <div className="h-8 px-12 flex items-center justify-between shrink-0 border-t border-[var(--border-color)]/40 bg-[var(--bg-secondary)]/60">
      <button
        type="button"
        onClick={onBack}
        aria-label="Android Back"
        className="w-9 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-[var(--text-secondary)]"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onHome}
        aria-label="Android Home"
        className="w-9 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-[var(--text-secondary)]"
      >
        <span className="w-3 h-3 rounded-full border-2 border-current" />
      </button>
      <div className="w-9 h-7 flex items-center justify-center text-[var(--text-secondary)]">
        <span className="w-2.5 h-2.5 rounded-[2px] border-2 border-current" />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 1. AppButton                                                               */
/* -------------------------------------------------------------------------- */

export interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const AppButton: React.FC<AppButtonProps> = ({
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const heightCls = size === 'lg' ? 'min-h-[52px] px-5 text-[15px]' : 'min-h-[44px] px-4 text-[14px]';
  const widthCls = fullWidth ? 'w-full' : '';

  const variantStyles: Record<string, string> = {
    primary:
      'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white font-semibold shadow-lg shadow-[#8B5CF6]/25 hover:brightness-110 active:scale-[0.98]',
    secondary:
      'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-color)] font-semibold hover:border-[#8B5CF6]/60 active:scale-[0.98]',
    outline:
      'bg-transparent text-[var(--text-primary)] border border-[var(--border-color)] font-medium hover:bg-[var(--bg-card)] active:scale-[0.98]',
    ghost:
      'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 font-medium',
    danger:
      'bg-[#EF4444]/15 text-[#F87171] border border-[#EF4444]/40 font-semibold hover:bg-[#EF4444]/25 active:scale-[0.98]',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] ${heightCls} ${widthCls} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. AppCard                                                                 */
/* -------------------------------------------------------------------------- */

export interface AppCardProps {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  selected = false,
  onClick,
  className = '',
  padding = 'md',
}) => {
  const padCls = padding === 'sm' ? 'p-3' : padding === 'lg' ? 'p-5' : 'p-4';
  const baseCls = `rounded-2xl border transition-all duration-150 ${padCls} ${
    selected
      ? 'bg-gradient-to-br from-[#8B5CF6]/20 to-[#6D28D9]/15 border-[#8B5CF6] shadow-[0_0_0_1px_rgba(139,92,246,0.35)]'
      : 'bg-[var(--bg-card)] border-[var(--border-color)]'
  } ${onClick ? 'cursor-pointer hover:border-[#8B5CF6]/60 active:scale-[0.99] text-left w-full' : ''} ${className}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseCls}>
        {children}
      </button>
    );
  }
  return <div className={baseCls}>{children}</div>;
};

/* -------------------------------------------------------------------------- */
/* 3. AppHeader                                                               */
/* -------------------------------------------------------------------------- */

export interface AppHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  subtitle?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ title, onBack, rightAction, subtitle }) => {
  return (
    <header className="min-h-[54px] px-4 py-2 flex items-center justify-between gap-2 shrink-0 border-b border-[var(--border-color)]/60 bg-[var(--bg-primary)]/90 backdrop-blur-md">
      <div className="w-11 flex items-center justify-start shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[#8B5CF6] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0 text-center">
        <h1 className="font-display font-bold text-[17px] text-[var(--text-primary)] truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] text-[var(--text-secondary)] truncate">{subtitle}</p>
        )}
      </div>
      <div className="min-w-[44px] flex items-center justify-end shrink-0">{rightAction}</div>
    </header>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. BottomNavigation                                                        */
/* -------------------------------------------------------------------------- */

export interface BottomNavigationProps {
  activeTab: 'home' | 'friends' | 'play' | 'ranking' | 'profile';
  onNavigate: (screen: ScreenId) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onNavigate }) => {
  const items: {
    key: BottomNavigationProps['activeTab'];
    label: string;
    screen: ScreenId;
    icon: React.ReactNode;
  }[] = [
    { key: 'home', label: 'Home', screen: 'home', icon: <Home className="w-5 h-5" /> },
    { key: 'friends', label: 'Friends', screen: 'friends', icon: <Users className="w-5 h-5" /> },
    { key: 'play', label: 'Play', screen: 'game_mode', icon: <Gamepad2 className="w-6 h-6" /> },
    { key: 'ranking', label: 'Ranking', screen: 'leaderboard', icon: <Trophy className="w-5 h-5" /> },
    { key: 'profile', label: 'Profile', screen: 'user_profile', icon: <User className="w-5 h-5" /> },
  ];

  return (
    <nav
      aria-label="Primary Mobile Navigation"
      className="h-[68px] px-2 grid grid-cols-5 items-center border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/95 backdrop-blur-md shrink-0"
    >
      {items.map((item) => {
        const isActive = activeTab === item.key;
        if (item.key === 'play') {
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.screen)}
              className="flex flex-col items-center justify-center -mt-4 cursor-pointer group focus-visible:outline-none"
            >
              <span
                className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white shadow-lg shadow-[#8B5CF6]/35 transition-transform duration-150 group-active:scale-95 ${
                  isActive ? 'ring-2 ring-white/40' : ''
                }`}
              >
                {item.icon}
              </span>
              <span
                className={`text-[10px] font-semibold mt-1 ${
                  isActive ? 'text-[#8B5CF6]' : 'text-[var(--text-secondary)]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        }

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.screen)}
            className="min-h-[48px] flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors focus-visible:outline-none"
          >
            <span className={isActive ? 'text-[#8B5CF6]' : 'text-[var(--text-secondary)]'}>
              {item.icon}
            </span>
            <span
              className={`text-[11px] font-medium whitespace-nowrap ${
                isActive ? 'text-[#8B5CF6] font-semibold' : 'text-[var(--text-secondary)]'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

/* -------------------------------------------------------------------------- */
/* 5 & 6. GameBoard & GameCell + Neon SVG Symbols                             */
/* -------------------------------------------------------------------------- */

export const SymbolMark: React.FC<{
  value: 'X' | 'O';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  glow?: boolean;
}> = ({ value, size = 'md', glow = true }) => {
  const dim =
    size === 'sm'
      ? 'w-4 h-4'
      : size === 'md'
      ? 'w-7 h-7'
      : size === 'lg'
      ? 'w-11 h-11'
      : 'w-14 h-14';

  if (value === 'X') {
    return (
      <svg
        viewBox="0 0 48 48"
        className={`${dim} animate-symbol-pop`}
        style={glow ? { filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.55))' } : undefined}
        fill="none"
        aria-label="X"
      >
        <path
          d="M12 12L36 36M36 12L12 36"
          stroke="var(--x-color)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 48 48"
      className={`${dim} animate-symbol-pop`}
      style={glow ? { filter: 'drop-shadow(0 0 8px rgba(244, 114, 182, 0.55))' } : undefined}
      fill="none"
      aria-label="O"
    >
      <circle cx="24" cy="24" r="13" stroke="var(--o-color)" strokeWidth="6" />
    </svg>
  );
};

export const GameCell: React.FC<{
  value: CellValue;
  index: number;
  boardSize: BoardSize;
  isWinning: boolean;
  isLastMove?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onPress: (index: number) => void;
}> = ({ value, index, boardSize, isWinning, isLastMove, disabled, compact, onPress }) => {
  const symbolSize = compact ? 'sm' : boardSize === 3 ? 'lg' : boardSize === 5 ? 'md' : 'sm';
  const radius = boardSize === 3 ? 'rounded-2xl' : 'rounded-xl';

  return (
    <button
      type="button"
      disabled={disabled || value !== null}
      onClick={() => onPress(index)}
      aria-label={`Cell ${index + 1}${value ? ` marked ${value}` : ' empty'}`}
      className={`aspect-square w-full flex items-center justify-center border transition-all duration-150 ${radius} ${
        isWinning
          ? 'bg-[#8B5CF6]/25 border-[#8B5CF6] shadow-[0_0_16px_rgba(139,92,246,0.35)]'
          : isLastMove
          ? 'bg-[var(--bg-elevated)] border-[#8B5CF6]/60'
          : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[#8B5CF6]/50'
      } ${!value && !disabled ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
    >
      {value && <SymbolMark value={value} size={symbolSize} glow={!compact} />}
    </button>
  );
};

export const GameBoard: React.FC<{
  board: CellValue[];
  size: BoardSize;
  winningLine?: number[] | null;
  lastMoveIndex?: number | null;
  disabled?: boolean;
  compact?: boolean;
  onCellPress?: (index: number) => void;
}> = ({
  board,
  size,
  winningLine = null,
  lastMoveIndex = null,
  disabled = false,
  compact = false,
  onCellPress,
}) => {
  const gridCols =
    size === 3 ? 'grid-cols-3 gap-2.5' : size === 5 ? 'grid-cols-5 gap-1.5' : 'grid-cols-6 gap-1';
  const pad = compact ? 'p-2' : size === 3 ? 'p-3.5' : 'p-2.5';

  return (
    <div
      className={`w-full max-w-[340px] mx-auto rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] ${pad}`}
    >
      <div className={`grid ${gridCols}`}>
        {board.map((cell, idx) => (
          <GameCell
            key={idx}
            index={idx}
            value={cell}
            boardSize={size}
            isWinning={winningLine ? winningLine.includes(idx) : false}
            isLastMove={lastMoveIndex === idx}
            disabled={disabled}
            compact={compact}
            onPress={(i) => onCellPress?.(i)}
          />
        ))}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 7. PlayerAvatar                                                            */
/* -------------------------------------------------------------------------- */

export const PlayerAvatar: React.FC<{
  avatarId: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'in_game' | 'offline';
  activeRing?: boolean;
}> = ({ avatarId, name, size = 'md', status, activeRing = false }) => {
  const preset = AVATAR_PRESETS.find((a) => a.id === avatarId) || AVATAR_PRESETS[0];
  const dim =
    size === 'sm'
      ? 'w-9 h-9 text-xs'
      : size === 'md'
      ? 'w-11 h-11 text-sm'
      : size === 'lg'
      ? 'w-14 h-14 text-base'
      : 'w-20 h-20 text-xl';

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`${dim} rounded-2xl bg-gradient-to-br ${preset.gradient} flex items-center justify-center font-display font-bold text-white overflow-hidden ${
          activeRing ? 'ring-2 ring-[#8B5CF6] ring-offset-2 ring-offset-[var(--bg-primary)]' : ''
        }`}
      >
        {preset.imageUrl ? (
          <img
            src={preset.imageUrl}
            alt={name || preset.label}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{name ? name.slice(0, 2).toUpperCase() : preset.initials}</span>
        )}
      </div>
      {status && (
        <span
          title={status}
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-primary)] ${
            status === 'online'
              ? 'bg-[#22C55E]'
              : status === 'in_game'
              ? 'bg-[#FBBF24]'
              : 'bg-[#64748B]'
          }`}
        />
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 8. PlayerInfoCard                                                          */
/* -------------------------------------------------------------------------- */

export const PlayerInfoCard: React.FC<{
  name: string;
  avatarId: string;
  symbol: 'X' | 'O';
  score: number;
  isActive: boolean;
  subtitle?: string;
}> = ({ name, avatarId, symbol, score, isActive, subtitle }) => {
  return (
    <div
      className={`flex-1 min-w-0 rounded-2xl p-3 border transition-all duration-150 ${
        isActive
          ? 'bg-[var(--bg-elevated)] border-[#8B5CF6] shadow-[0_0_18px_rgba(139,92,246,0.22)]'
          : 'bg-[var(--bg-card)] border-[var(--border-color)] opacity-80'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <PlayerAvatar avatarId={avatarId} name={name} size="sm" activeRing={isActive} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
              {name}
            </span>
            <SymbolMark value={symbol} size="sm" glow={isActive} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] mt-0.5">
            <span className="truncate">{isActive ? 'Your Turn' : subtitle || 'Waiting'}</span>
            <span className="font-mono-num font-bold text-[var(--text-primary)]">{score}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 9. ScoreCard                                                               */
/* -------------------------------------------------------------------------- */

export const ScoreCard: React.FC<{
  label: string;
  value: string | number;
  subtext?: string;
  tone?: 'default' | 'accent' | 'success' | 'warning';
}> = ({ label, value, subtext, tone = 'default' }) => {
  const valColor =
    tone === 'accent'
      ? 'text-[#8B5CF6]'
      : tone === 'success'
      ? 'text-[#22C55E]'
      : tone === 'warning'
      ? 'text-[#FBBF24]'
      : 'text-[var(--text-primary)]';

  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-3.5 text-center">
      <div className={`font-display font-bold text-2xl font-mono-num ${valColor}`}>{value}</div>
      <div className="text-[12px] font-medium text-[var(--text-secondary)] mt-0.5">{label}</div>
      {subtext && <div className="text-[11px] text-[var(--text-secondary)]/80 mt-0.5">{subtext}</div>}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 10. GameModeCard                                                           */
/* -------------------------------------------------------------------------- */

export const GameModeCard: React.FC<{
  title: string;
  description: string;
  metaText: string;
  icon: React.ReactNode;
  featured?: boolean;
  onClick: () => void;
}> = ({ title, description, metaText, icon, featured = false, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-4 border transition-all duration-150 cursor-pointer active:scale-[0.99] flex items-center gap-3.5 ${
        featured
          ? 'bg-gradient-to-br from-[#8B5CF6]/25 via-[#6D28D9]/15 to-[var(--bg-card)] border-[#8B5CF6]'
          : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-[#8B5CF6]/60'
      }`}
    >
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
          featured
            ? 'bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white'
            : 'bg-[var(--bg-elevated)] text-[#8B5CF6] border border-[var(--border-color)]'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-semibold text-[15px] text-[var(--text-primary)] truncate">
          {title}
        </h3>
        <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">{description}</p>
        <p className="text-[11px] text-[var(--text-secondary)]/80 mt-1">{metaText}</p>
      </div>
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* 11. AchievementCard                                                        */
/* -------------------------------------------------------------------------- */

export const AchievementCard: React.FC<{
  achievement: Achievement;
  onClaim?: (id: string) => void;
}> = ({ achievement, onClaim }) => {
  const pct = Math.min(100, Math.round((achievement.progress / achievement.target) * 100));

  return (
    <AppCard selected={achievement.unlocked} className="space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              achievement.unlocked
                ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-color)]'
            }`}
          >
            {achievement.unlocked ? <Award className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h4 className="font-display font-semibold text-[14px] text-[var(--text-primary)] truncate">
              {achievement.title}
            </h4>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 leading-snug">
              {achievement.description}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="font-mono-num text-[12px] font-bold text-[#FBBF24] flex items-center gap-1">
            <Coins className="w-3.5 h-3.5" />
            +{achievement.rewardCoins}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
          <span>
            {achievement.category} · {achievement.unlocked ? 'Unlocked' : 'In Progress'}
          </span>
          <span className="font-mono-num">
            {achievement.progress}/{achievement.target}
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              achievement.unlocked ? 'bg-[#22C55E]' : 'bg-[#8B5CF6]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {achievement.unlocked && onClaim && (
        <button
          type="button"
          onClick={() => onClaim(achievement.id)}
          className="text-[12px] font-semibold text-[#22C55E] hover:underline cursor-pointer"
        >
          Reward Collected
        </button>
      )}
    </AppCard>
  );
};

/* -------------------------------------------------------------------------- */
/* 12. LeaderboardItem                                                        */
/* -------------------------------------------------------------------------- */

export const LeaderboardItem: React.FC<{
  entry: LeaderboardEntry;
  onSelect?: (entry: LeaderboardEntry) => void;
}> = ({ entry, onSelect }) => {
  return (
    <AppCard
      selected={entry.isCurrentUser}
      padding="sm"
      onClick={onSelect ? () => onSelect(entry) : undefined}
      className="flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`w-7 text-center font-mono-num font-bold text-sm shrink-0 ${
            entry.rank <= 3 ? 'text-[#FBBF24]' : 'text-[var(--text-secondary)]'
          }`}
        >
          #{entry.rank}
        </span>
        <PlayerAvatar avatarId={entry.avatarId} name={entry.username} size="sm" />
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
            {entry.username} {entry.isCurrentUser ? '(You)' : ''}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] font-mono-num">
            {entry.wins} wins · {entry.winRate}% win rate
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono-num font-bold text-[14px] text-[#8B5CF6]">{entry.rating}</div>
        <div className="text-[10px] text-[var(--text-secondary)]">Rating</div>
      </div>
    </AppCard>
  );
};

/* -------------------------------------------------------------------------- */
/* 13. RewardCard                                                             */
/* -------------------------------------------------------------------------- */

export const RewardCard: React.FC<{
  reward: DailyReward;
  onClaim: (day: number) => void;
}> = ({ reward, onClaim }) => {
  const isClaimable = reward.status === 'claimable';
  const isClaimed = reward.status === 'claimed';

  return (
    <button
      type="button"
      disabled={!isClaimable}
      onClick={() => isClaimable && onClaim(reward.day)}
      className={`rounded-2xl p-3 border text-center transition-all duration-150 flex flex-col items-center justify-between min-h-[104px] ${
        isClaimable
          ? 'bg-gradient-to-br from-[#8B5CF6]/30 to-[#6D28D9]/20 border-[#8B5CF6] cursor-pointer hover:brightness-110 active:scale-95'
          : isClaimed
          ? 'bg-[var(--bg-card)] border-[#22C55E]/40 opacity-85'
          : 'bg-[var(--bg-card)] border-[var(--border-color)] opacity-60'
      }`}
    >
      <span className="text-[11px] font-medium text-[var(--text-secondary)]">Day {reward.day}</span>
      <div className="my-1">
        {isClaimed ? (
          <CheckCircle2 className="w-6 h-6 text-[#22C55E] mx-auto" />
        ) : (
          <Coins className={`w-6 h-6 mx-auto ${isClaimable ? 'text-[#FBBF24]' : 'text-[var(--text-secondary)]'}`} />
        )}
      </div>
      <div>
        <div className="font-mono-num font-bold text-[13px] text-[var(--text-primary)]">
          +{reward.coins}
        </div>
        {reward.bonusLabel && (
          <div className="text-[10px] text-[#F472B6] font-medium mt-0.5">{reward.bonusLabel}</div>
        )}
      </div>
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* 14. ThemeCard                                                              */
/* -------------------------------------------------------------------------- */

export const ThemeCard: React.FC<{
  theme: ThemeDefinition;
  selected: boolean;
  onSelect: () => void;
}> = ({ theme, selected, onSelect }) => {
  return (
    <AppCard selected={selected} onClick={onSelect} padding="sm" className="space-y-2.5">
      {/* Live Mini Board Preview */}
      <div
        className="rounded-xl p-2.5 border"
        style={{
          backgroundColor: theme.bg,
          borderColor: selected ? theme.accent : 'rgba(255,255,255,0.08)',
        }}
      >
        <div className="grid grid-cols-3 gap-1.5 w-20 mx-auto">
          {['X', 'O', null, null, 'X', 'O', null, null, 'X'].map((mark, i) => (
            <div
              key={i}
              className="aspect-square rounded-md flex items-center justify-center text-[10px] font-bold"
              style={{ backgroundColor: theme.card }}
            >
              {mark === 'X' && <span style={{ color: theme.xColor }}>X</span>}
              {mark === 'O' && <span style={{ color: theme.oColor }}>O</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display font-semibold text-[13px] text-[var(--text-primary)] truncate">
            {theme.name}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] truncate">{theme.subtitle}</div>
        </div>
        {selected && (
          <span className="w-6 h-6 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </AppCard>
  );
};

/* -------------------------------------------------------------------------- */
/* 15. CustomModal                                                            */
/* -------------------------------------------------------------------------- */

export const CustomModal: React.FC<{
  open: boolean;
  title: string;
  platform?: Platform;
  onClose?: () => void;
  children: React.ReactNode;
}> = ({ open, title, platform = 'ios', onClose, children }) => {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <div
        className={`w-full bg-[var(--bg-card)] border border-[var(--border-color)] p-5 shadow-2xl ${
          platform === 'ios' ? 'rounded-3xl' : 'rounded-2xl'
        }`}
      >
        {platform === 'ios' && (
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
        )}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-lg text-[var(--text-primary)]">{title}</h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 16. LoadingIndicator                                                       */
/* -------------------------------------------------------------------------- */

export const LoadingIndicator: React.FC<{ label?: string; sublabel?: string }> = ({
  label = 'Loading...',
  sublabel,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="relative w-14 h-14 flex items-center justify-center">
        <div className="absolute inset-0 rounded-2xl border-2 border-[#8B5CF6]/25" />
        <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-[#8B5CF6] border-r-[#38BDF8] animate-spin" />
        <span className="font-display font-bold text-sm text-[var(--text-primary)]">XO</span>
      </div>
      <p className="font-display font-semibold text-[15px] text-[var(--text-primary)] mt-4">
        {label}
      </p>
      {sublabel && <p className="text-[12px] text-[var(--text-secondary)] mt-1">{sublabel}</p>}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 17. EmptyState                                                             */
/* -------------------------------------------------------------------------- */

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => {
  return (
    <AppCard padding="lg" className="text-center space-y-3 my-4">
      <div className="w-12 h-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center mx-auto text-[#8B5CF6]">
        <Gamepad2 className="w-6 h-6" />
      </div>
      <div>
        <h3 className="font-display font-semibold text-[16px] text-[var(--text-primary)]">{title}</h3>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <AppButton size="md" onClick={onAction} className="mt-2">
          {actionLabel}
        </AppButton>
      )}
    </AppCard>
  );
};

/* -------------------------------------------------------------------------- */
/* 18. ErrorState                                                             */
/* -------------------------------------------------------------------------- */

export const ErrorState: React.FC<{
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  offline?: boolean;
}> = ({ title, message, retryLabel = 'Try Again', onRetry, offline = false }) => {
  return (
    <AppCard padding="lg" className="text-center space-y-3 my-4 border-[#EF4444]/40">
      <div className="w-12 h-12 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/35 flex items-center justify-center mx-auto text-[#F87171]">
        {offline ? <WifiOff className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
      </div>
      <div>
        <h3 className="font-display font-semibold text-[16px] text-[var(--text-primary)]">{title}</h3>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <AppButton variant="secondary" size="md" onClick={onRetry}>
          {retryLabel}
        </AppButton>
      )}
    </AppCard>
  );
};

/* -------------------------------------------------------------------------- */
/* 19. ConfirmationDialog                                                     */
/* -------------------------------------------------------------------------- */

export const ConfirmationDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="w-full rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] p-5 space-y-4 shadow-2xl">
        <div>
          <h3 className="font-display font-bold text-[18px] text-[var(--text-primary)]">{title}</h3>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">{message}</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <AppButton variant="outline" size="md" onClick={onCancel}>
            {cancelLabel}
          </AppButton>
          <AppButton
            variant={destructive ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
          >
            {confirmLabel}
          </AppButton>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 20. ToastNotification                                                      */
/* -------------------------------------------------------------------------- */

export const ToastNotification: React.FC<{
  toast: ToastData | null;
  onDismiss: () => void;
}> = ({ toast, onDismiss }) => {
  if (!toast) return null;

  const icon =
    toast.type === 'success' ? (
      <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
    ) : toast.type === 'error' ? (
      <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
    ) : toast.type === 'warning' ? (
      <AlertTriangle className="w-4 h-4 text-[#FBBF24]" />
    ) : (
      <Info className="w-4 h-4 text-[#38BDF8]" />
    );

  return (
    <div className="absolute top-12 left-4 right-4 z-50 pointer-events-auto">
      <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-3.5 py-2.5 shadow-xl flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0">{icon}</span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
              {toast.title}
            </div>
            {toast.message && (
              <div className="text-[11px] text-[var(--text-secondary)] truncate">
                {toast.message}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
