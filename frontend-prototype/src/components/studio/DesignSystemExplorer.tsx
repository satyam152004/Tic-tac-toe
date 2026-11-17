import React, { useState } from 'react';
import { Bot, CheckCircle2, Globe } from 'lucide-react';
import {
  AchievementCard,
  AppButton,
  AppCard,
  EmptyState,
  ErrorState,
  GameBoard,
  GameModeCard,
  LeaderboardItem,
  LoadingIndicator,
  PlayerAvatar,
  PlayerInfoCard,
  RewardCard,
  ScoreCard,
  SymbolMark,
  ThemeCard,
} from '../ds/DesignSystemComponents';
import {
  GLOBAL_LEADERBOARD,
  INITIAL_ACHIEVEMENTS,
  INITIAL_REWARDS,
  SCREEN_CATALOG,
  THEME_LIST,
} from '../../data/mockData';
import { ScreenCategory, ScreenId } from '../../types/app';

export const DesignSystemExplorer: React.FC<{
  onOpenScreen?: (id: ScreenId) => void;
}> = () => {
  const colorTokens = [
    { name: 'Primary Background', hex: '#0B0718' },
    { name: 'Secondary Background', hex: '#15102A' },
    { name: 'Card Background', hex: '#1C1635' },
    { name: 'Primary Purple', hex: '#8B5CF6' },
    { name: 'Secondary Purple', hex: '#6D28D9' },
    { name: 'Electric Blue (X)', hex: '#38BDF8' },
    { name: 'Neon Pink (O)', hex: '#F472B6' },
    { name: 'Success Green', hex: '#22C55E' },
    { name: 'Warning Yellow', hex: '#FBBF24' },
    { name: 'Primary Text', hex: '#FFFFFF' },
    { name: 'Secondary Text', hex: '#A8A0BC' },
    { name: 'Border', hex: '#30264D' },
  ];

  const spacingScale = [
    { token: 'space-1', px: '8px', note: 'Tight icon/text gap' },
    { token: 'space-2', px: '16px', note: 'Standard screen margin & card pad' },
    { token: 'space-3', px: '24px', note: 'Section rhythm & card spacing' },
    { token: 'space-4', px: '32px', note: 'Major vertical block separation' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 text-white">
      <div className="space-y-1">
        <h2 className="font-display font-bold text-2xl">
          Tic Tac Toe Dark Gaming Design System
        </h2>
        <p className="text-sm text-[#A8A0BC]">
          Shared tokens, 8-point spacing scale, typography hierarchy, and 20 reusable React / React Native architecture components.
        </p>
      </div>

      {/* 1. Color Tokens */}
      <section className="space-y-3">
        <h3 className="font-display font-semibold text-base text-white">01. Color Tokens</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {colorTokens.map((c) => (
            <div
              key={c.name}
              className="rounded-2xl bg-[#1C1635] border border-[#30264D] p-3 flex items-center gap-3"
            >
              <div
                className="w-10 h-10 rounded-xl border border-white/15 shrink-0"
                style={{ backgroundColor: c.hex }}
              />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{c.name}</div>
                <div className="text-[11px] font-mono-num text-[#A8A0BC]">{c.hex}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Typography & 8-pt Spacing */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#1C1635] border border-[#30264D] p-5 space-y-3">
          <h3 className="font-display font-semibold text-base">02. Typography Scale</h3>
          <div className="space-y-2.5 border-t border-[#30264D] pt-3">
            <div className="flex items-baseline justify-between">
              <span className="font-display font-extrabold text-2xl">Display Title</span>
              <span className="text-xs font-mono-num text-[#A8A0BC]">Outfit · 24px / 800</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-display font-bold text-lg">Section Heading</span>
              <span className="text-xs font-mono-num text-[#A8A0BC]">Outfit · 18px / 700</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Primary Body Copy</span>
              <span className="text-xs font-mono-num text-[#A8A0BC]">Plus Jakarta · 14px / 500</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono-num text-sm text-[#38BDF8]">1,642 PTS · 00:24</span>
              <span className="text-xs font-mono-num text-[#A8A0BC]">JetBrains Mono · Tabular</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-[#1C1635] border border-[#30264D] p-5 space-y-3">
          <h3 className="font-display font-semibold text-base">
            03. 8-Point Spacing &amp; Radius System
          </h3>
          <div className="space-y-2.5 border-t border-[#30264D] pt-3">
            {spacingScale.map((s) => (
              <div key={s.token} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 rounded bg-[#8B5CF6]"
                    style={{ width: s.px }}
                  />
                  <span className="font-mono-num text-white">{s.px}</span>
                </div>
                <span className="text-[#A8A0BC]">{s.note}</span>
              </div>
            ))}
            <div className="pt-2 text-xs text-[#A8A0BC] font-mono-num">
              Radii: Cells 12–16px · Cards 16–24px · Buttons 16px (48–52px height) · Touch Targets ≥ 44pt
            </div>
          </div>
        </div>
      </section>

      {/* 3. Live Component Showcase */}
      <section className="space-y-4">
        <h3 className="font-display font-semibold text-base">
          04. Reusable Component Library (20 Components)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AppCard className="space-y-3">
            <div className="text-xs font-semibold text-[#A8A0BC]">AppButton Variants</div>
            <AppButton fullWidth>Primary CTA</AppButton>
            <div className="grid grid-cols-2 gap-2">
              <AppButton variant="secondary" size="md">Secondary</AppButton>
              <AppButton variant="outline" size="md">Outline</AppButton>
              <AppButton variant="ghost" size="md">Ghost</AppButton>
              <AppButton variant="danger" size="md">Danger</AppButton>
            </div>
          </AppCard>

          <AppCard className="space-y-3">
            <div className="text-xs font-semibold text-[#A8A0BC]">GameBoard &amp; Glowing Marks</div>
            <GameBoard
              size={3}
              board={['X', 'O', null, null, 'X', 'O', null, null, 'X']}
              winningLine={[0, 4, 8]}
              compact
              disabled
            />
            <div className="flex items-center justify-center gap-4">
              <SymbolMark value="X" size="md" />
              <SymbolMark value="O" size="md" />
            </div>
          </AppCard>

          <AppCard className="space-y-3">
            <div className="text-xs font-semibold text-[#A8A0BC]">PlayerInfoCard &amp; ScoreCard</div>
            <PlayerInfoCard
              name="AidenVance"
              avatarId="av_1"
              symbol="X"
              score={3}
              isActive
            />
            <div className="grid grid-cols-2 gap-2">
              <ScoreCard label="Wins" value={84} tone="success" />
              <ScoreCard label="Rating" value={1642} tone="accent" />
            </div>
          </AppCard>

          <div className="space-y-3">
            <GameModeCard
              title="Player vs AI"
              description="Adaptive Easy, Medium & Hard bots"
              metaText="Offline · 3x3, 5x5 & 6x6"
              icon={<Bot className="w-5 h-5" />}
              featured
              onClick={() => {}}
            />
            <GameModeCard
              title="Online Multiplayer"
              description="Quick Match & Private Rooms"
              metaText="Ranked · Real-time"
              icon={<Globe className="w-5 h-5" />}
              onClick={() => {}}
            />
          </div>

          <div className="space-y-3">
            <LeaderboardItem entry={GLOBAL_LEADERBOARD[4]} />
            <AchievementCard achievement={INITIAL_ACHIEVEMENTS[1]} />
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <RewardCard reward={INITIAL_REWARDS[2]} onClaim={() => {}} />
              <ThemeCard theme={THEME_LIST[0]} selected onSelect={() => {}} />
            </div>
          </div>

          <LoadingIndicator label="Matchmaking" sublabel="Searching nearby Elo" />
          <EmptyState
            title="No Pending Invites"
            description="Challenge a friend from your roster to start a match."
          />
          <ErrorState
            offline
            title="Connection Lost"
            message="Attempting to restore your active multiplayer match."
          />
        </div>
      </section>
    </div>
  );
};

export const AllScreensGallery: React.FC<{
  activeScreen: ScreenId;
  onSelectScreen: (id: ScreenId) => void;
}> = ({ activeScreen, onSelectScreen }) => {
  const [catFilter, setCatFilter] = useState<'All' | ScreenCategory>('All');
  const categories: ('All' | ScreenCategory)[] = [
    'All',
    'Onboarding & Core',
    'Offline Game',
    'Online Multiplayer',
    'Auth & Profile',
    'Social & Progression',
    'Settings & Themes',
  ];

  const items =
    catFilter === 'All'
      ? SCREEN_CATALOG
      : SCREEN_CATALOG.filter((s) => s.category === catFilter);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl">Complete 40-Screen Architecture</h2>
          <p className="text-sm text-[#A8A0BC]">
            Click any screen card to launch and interact with it inside the live mobile device simulator.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCatFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                catFilter === cat
                  ? 'bg-[#8B5CF6] text-white'
                  : 'bg-[#1C1635] border border-[#30264D] text-[#A8A0BC] hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {items.map((scr) => {
          const isActive = scr.id === activeScreen;
          return (
            <button
              key={scr.id}
              type="button"
              onClick={() => onSelectScreen(scr.id)}
              className={`text-left rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                isActive
                  ? 'bg-gradient-to-br from-[#8B5CF6]/25 to-[#1C1635] border-[#8B5CF6]'
                  : 'bg-[#1C1635] border-[#30264D] hover:border-[#8B5CF6]/60'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono-num text-[#A8A0BC]">
                  <span>Screen {String(scr.number).padStart(2, '0')}</span>
                  {isActive && <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />}
                </div>
                <h3 className="font-display font-bold text-[15px] text-white">{scr.title}</h3>
                <p className="text-xs text-[#A8A0BC] leading-relaxed">{scr.summary}</p>
              </div>

              <div className="pt-2 border-t border-[#30264D]/70 flex items-center justify-between text-[11px] text-[#A8A0BC]">
                <span className="truncate">{scr.category}</span>
                <span className="text-[#8B5CF6] font-semibold shrink-0 ml-2">Open →</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
