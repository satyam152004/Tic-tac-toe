import React, { useState } from 'react';
import {
  Check,
  Coins,
  Crown,
  Gift,
  Search,
  Swords,
  UserPlus,
} from 'lucide-react';
import {
  AchievementCard,
  AppButton,
  AppCard,
  AppHeader,
  BottomNavigation,
  EmptyState,
  LeaderboardItem,
  PlayerAvatar,
  RewardCard,
  ScoreCard,
} from '../components/ds/DesignSystemComponents';
import {
  Achievement,
  DailyReward,
  Friend,
  LeaderboardEntry,
  PlayerProfile,
  ScreenId,
} from '../types/app';

export interface SocialProgressionScreensProps {
  screen: ScreenId;
  user: PlayerProfile;
  leaderboard: LeaderboardEntry[];
  friends: Friend[];
  selectedFriend: Friend;
  achievements: Achievement[];
  rewards: DailyReward[];
  onSelectFriend: (f: Friend) => void;
  onAcceptFriendRequest: (id: string) => void;
  onAddFriend: (username: string) => void;
  onClaimReward: (day: number) => void;
  onChallengeFriend: (f: Friend) => void;
  onNavigate: (screen: ScreenId) => void;
  onBack: () => void;
  onNotify: (title: string, message?: string) => void;
}

export const SocialProgressionScreens: React.FC<SocialProgressionScreensProps> = ({
  screen,
  user,
  leaderboard,
  friends,
  selectedFriend,
  achievements,
  rewards,
  onSelectFriend,
  onAcceptFriendRequest,
  onAddFriend,
  onClaimReward,
  onChallengeFriend,
  onNavigate,
  onBack,
  onNotify,
}) => {
  const [lbTab, setLbTab] = useState<'global' | 'friends'>('global');
  const [friendQuery, setFriendQuery] = useState('');
  const [achCategory, setAchCategory] = useState<'All' | Achievement['category']>('All');

  /* 33. Leaderboard Screen */
  if (screen === 'leaderboard') {
    const filtered =
      lbTab === 'global'
        ? leaderboard
        : leaderboard.filter((e) => e.isFriend || e.isCurrentUser);
    const topThree = filtered.slice(0, 3);

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="Leaderboard" subtitle="Season 4 Standings" onBack={onBack} />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          {/* Segmented Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            {(['global', 'friends'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setLbTab(tab)}
                className={`min-h-[40px] rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  lbTab === tab
                    ? 'bg-[#8B5CF6] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab === 'global' ? 'Global Rankings' : 'Friends'}
              </button>
            ))}
          </div>

          {/* Top 3 Podium */}
          {topThree.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 items-end pt-2">
              {/* 2nd */}
              <AppCard padding="sm" className="text-center space-y-1.5">
                <div className="text-xs font-mono-num font-bold text-[#38BDF8]">#2</div>
                <PlayerAvatar avatarId={topThree[1].avatarId} name={topThree[1].username} size="md" />
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  {topThree[1].username}
                </div>
                <div className="text-[11px] font-mono-num text-[var(--text-secondary)]">
                  {topThree[1].rating}
                </div>
              </AppCard>
              {/* 1st */}
              <AppCard selected padding="sm" className="text-center space-y-1.5 pb-4">
                <Crown className="w-5 h-5 text-[#FBBF24] mx-auto" />
                <PlayerAvatar avatarId={topThree[0].avatarId} name={topThree[0].username} size="lg" activeRing />
                <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {topThree[0].username}
                </div>
                <div className="text-[11px] font-mono-num font-bold text-[#FBBF24]">
                  {topThree[0].rating}
                </div>
              </AppCard>
              {/* 3rd */}
              <AppCard padding="sm" className="text-center space-y-1.5">
                <div className="text-xs font-mono-num font-bold text-[#F472B6]">#3</div>
                <PlayerAvatar avatarId={topThree[2].avatarId} name={topThree[2].username} size="md" />
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  {topThree[2].username}
                </div>
                <div className="text-[11px] font-mono-num text-[var(--text-secondary)]">
                  {topThree[2].rating}
                </div>
              </AppCard>
            </div>
          )}

          {/* Full List */}
          <div className="space-y-2">
            {filtered.map((entry) => (
              <LeaderboardItem
                key={entry.id}
                entry={entry}
                onSelect={() => {
                  if (entry.isCurrentUser) {
                    onNavigate('user_profile');
                  } else {
                    const matched = friends.find((f) => f.username === entry.username);
                    if (matched) onSelectFriend(matched);
                    onNavigate('friend_profile');
                  }
                }}
              />
            ))}
          </div>
        </div>

        <BottomNavigation activeTab="ranking" onNavigate={onNavigate} />
      </div>
    );
  }

  /* 34. Friends Screen */
  if (screen === 'friends') {
    const requests = friends.filter((f) => f.pendingRequest);
    const activeFriends = friends
      .filter((f) => !f.pendingRequest)
      .filter((f) => f.username.toLowerCase().includes(friendQuery.toLowerCase()));

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader
          title="Friends"
          subtitle={`${friends.filter((f) => !f.pendingRequest && f.status === 'online').length} online`}
          onBack={onBack}
          rightAction={
            <button
              type="button"
              aria-label="Add friend"
              onClick={() => {
                onAddFriend('DevonCruz');
                onNotify('Friend Request Sent', 'Invited DevonCruz');
              }}
              className="w-11 h-11 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[#8B5CF6] cursor-pointer"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          }
        />

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={friendQuery}
              onChange={(e) => setFriendQuery(e.target.value)}
              placeholder="Search friends by username..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          {/* Pending Friend Requests */}
          {requests.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)]">
                Friend Requests ({requests.length})
              </h3>
              {requests.map((req) => (
                <AppCard key={req.id} padding="sm" className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerAvatar avatarId={req.avatarId} name={req.username} size="sm" status={req.status} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {req.username}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] font-mono-num">
                        Level {req.level} · {req.rating} pts
                      </div>
                    </div>
                  </div>
                  <AppButton
                    size="md"
                    icon={<Check className="w-4 h-4" />}
                    onClick={() => onAcceptFriendRequest(req.id)}
                  >
                    Accept
                  </AppButton>
                </AppCard>
              ))}
            </div>
          )}

          {/* Friends Roster */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)]">
              Friends List ({activeFriends.length})
            </h3>
            {activeFriends.length === 0 ? (
              <EmptyState
                title="No Friends Found"
                description="Try another search query or add new rivals from the leaderboard."
              />
            ) : (
              activeFriends.map((friend) => (
                <AppCard key={friend.id} padding="sm" className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectFriend(friend);
                      onNavigate('friend_profile');
                    }}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <PlayerAvatar
                      avatarId={friend.avatarId}
                      name={friend.username}
                      size="sm"
                      status={friend.status}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {friend.username}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {friend.status === 'online'
                          ? 'Online'
                          : friend.status === 'in_game'
                          ? 'In Match'
                          : 'Offline'}{' '}
                        · {friend.rating} pts
                      </div>
                    </div>
                  </button>
                  <AppButton
                    size="md"
                    variant="secondary"
                    icon={<Swords className="w-4 h-4 text-[#8B5CF6]" />}
                    onClick={() => onChallengeFriend(friend)}
                  >
                    Invite
                  </AppButton>
                </AppCard>
              ))
            )}
          </div>
        </div>

        <BottomNavigation activeTab="friends" onNavigate={onNavigate} />
      </div>
    );
  }

  /* 35. Friend Profile Screen */
  if (screen === 'friend_profile') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title={selectedFriend.username} onBack={onBack} />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          <AppCard className="text-center space-y-3">
            <PlayerAvatar
              avatarId={selectedFriend.avatarId}
              name={selectedFriend.username}
              size="xl"
              status={selectedFriend.status}
              activeRing
            />
            <div>
              <h2 className="font-display font-bold text-xl text-[var(--text-primary)]">
                {selectedFriend.username}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] font-mono-num">
                Level {selectedFriend.level} · {selectedFriend.rating} Rating
              </p>
            </div>
          </AppCard>

          <div className="grid grid-cols-3 gap-2.5">
            <ScoreCard label="Wins" value={selectedFriend.wins} tone="success" />
            <ScoreCard label="Win Rate" value={`${selectedFriend.winRate}%`} tone="accent" />
            <ScoreCard label="Draws" value={selectedFriend.draws} />
          </div>

          <AppCard className="space-y-2">
            <h3 className="font-display font-semibold text-sm text-[var(--text-primary)]">
              Head-to-Head History
            </h3>
            <div className="text-xs text-[var(--text-secondary)] flex items-center justify-between py-1 border-b border-[var(--border-color)]/50">
              <span>5x5 Ranked · Yesterday</span>
              <span className="font-semibold text-[#22C55E]">You Won</span>
            </div>
            <div className="text-xs text-[var(--text-secondary)] flex items-center justify-between py-1">
              <span>3x3 Classic · Nov 12</span>
              <span className="font-semibold text-[#FBBF24]">Draw</span>
            </div>
          </AppCard>
        </div>

        <div className="p-4 border-t border-[var(--border-color)]/60">
          <AppButton
            fullWidth
            icon={<Swords className="w-4 h-4" />}
            onClick={() => onChallengeFriend(selectedFriend)}
          >
            Challenge to Match
          </AppButton>
        </div>
      </div>
    );
  }

  /* 36. Game Statistics Screen */
  if (screen === 'game_statistics') {
    const total = user.wins + user.losses + user.draws;
    const winPct = total > 0 ? Math.round((user.wins / total) * 100) : 0;
    const weeklyTrend = [52, 58, 55, 62, 66, 61, winPct];

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader title="Game Statistics" onBack={onBack} />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <ScoreCard label="Total Games" value={total} />
            <ScoreCard label="Win Percentage" value={`${winPct}%`} tone="accent" />
            <ScoreCard label="Wins" value={user.wins} tone="success" />
            <ScoreCard label="Losses / Draws" value={`${user.losses} / ${user.draws}`} />
          </div>

          <AppCard className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm text-[var(--text-primary)]">
                7-Day Win Rate Trend
              </h3>
              <span className="text-xs font-mono-num text-[#22C55E]">+8% this week</span>
            </div>
            <div className="h-32 flex items-end justify-between gap-2 pt-3">
              {weeklyTrend.map((val, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-[#6D28D9] to-[#38BDF8] transition-all"
                    style={{ height: `${val}%` }}
                  />
                  <span className="text-[10px] font-mono-num text-[var(--text-secondary)]">
                    D{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </AppCard>
        </div>
      </div>
    );
  }

  /* 37. Achievements Screen */
  if (screen === 'achievements') {
    const categories: ('All' | Achievement['category'])[] = [
      'All',
      'Strategy',
      'Multiplayer',
      'Milestones',
    ];
    const items =
      achCategory === 'All'
        ? achievements
        : achievements.filter((a) => a.category === achCategory);

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <AppHeader
          title="Achievements"
          subtitle={`${achievements.filter((a) => a.unlocked).length} of ${achievements.length} unlocked`}
          onBack={onBack}
        />
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setAchCategory(cat)}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  achCategory === cat
                    ? 'bg-[#8B5CF6] text-white'
                    : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {items.map((ach) => (
              <AchievementCard key={ach.id} achievement={ach} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* 38. Daily Rewards Screen */
  const claimableDay = rewards.find((r) => r.status === 'claimable');
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AppHeader
        title="Daily Rewards"
        onBack={onBack}
        rightAction={
          <span className="font-mono-num text-xs font-bold text-[#FBBF24] flex items-center gap-1">
            <Coins className="w-4 h-4" /> {user.coins}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        <AppCard className="flex items-center gap-3.5 bg-gradient-to-br from-[#8B5CF6]/20 to-[var(--bg-card)]">
          <div className="w-12 h-12 rounded-2xl bg-[#FBBF24]/20 text-[#FBBF24] flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-[var(--text-primary)]">
              7-Day Streak Calendar
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Log in daily to earn bonus coins and unlock the Day 7 Neon Frame.
            </p>
          </div>
        </AppCard>

        <div className="grid grid-cols-3 gap-2.5">
          {rewards.slice(0, 6).map((reward) => (
            <RewardCard key={reward.day} reward={reward} onClaim={onClaimReward} />
          ))}
        </div>

        {/* Day 7 Featured Card */}
        <RewardCard reward={rewards[6]} onClaim={onClaimReward} />
      </div>

      <div className="p-4 border-t border-[var(--border-color)]/60">
        <AppButton
          fullWidth
          disabled={!claimableDay}
          onClick={() => claimableDay && onClaimReward(claimableDay.day)}
        >
          {claimableDay ? `Claim Day ${claimableDay.day} (+${claimableDay.coins} Coins)` : 'Today Reward Claimed'}
        </AppButton>
      </div>
    </div>
  );
};
