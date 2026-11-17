import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Award, Bell, Coins, Cpu, Gift, Globe, History, Play, RotateCcw, Settings, Trophy, UserPlus, Users, WifiOff } from 'lucide-react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { SymbolMark } from '../../components/game/SymbolMark';
import { GameModeCard, ScoreCard } from '../../components/profile/Cards';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useMe, useNotifications } from '../../hooks/queries';
import { useAppNav } from '../../navigation/useAppNav';
import { toApiError } from '../../services/api/errors';
import { ActiveLocalGame, localGameStorage } from '../../services/storage/localGameStorage';
import { useAuthStore, useIsGuest } from '../../store/authStore';
import { useLocalGameStore } from '../../store/localGameStore';
import { isTerminal, useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';

/** Loads the interrupted offline match (if any) every time the screen gains focus. */
function useInterruptedMatch() {
  const [active, setActive] = useState<ActiveLocalGame | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      localGameStorage
        .loadActive()
        .then((a) => live && setActive(a && a.state.outcome.status === 'IN_PROGRESS' ? a : null))
        .catch(() => live && setActive(null));
      return () => {
        live = false;
      };
    }, []),
  );
  return { active, clear: () => setActive(null) };
}

const levelProgress = (xp: number, from: number, to: number) => (to > from ? Math.max(0, Math.min(1, (xp - from) / (to - from))) : 1);

export const HomeScreen: React.FC = () => {
  const c = useTheme();
  const { nav, goTab } = useAppNav();
  const me = useMe();
  const notifications = useNotifications();
  const offline = useAuthStore((s) => s.offline);
  const isGuest = useIsGuest();
  const onlineGame = useOnlineStore((s) => s.game);
  const { active, clear } = useInterruptedMatch();
  const [refreshing, setRefreshing] = useState(false);

  const user = me.data;
  const unread = notifications.data?.unread ?? 0;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([me.refetch(), notifications.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const resume = () => {
    if (!active) return;
    useLocalGameStore.getState().resume(active);
    nav.navigate('offline_board');
  };
  const discard = async () => {
    try {
      await localGameStorage.clearActive();
      clear();
    } catch {
      toast.error('Could not discard match');
    }
  };

  if (!user) {
    return (
      <Screen tabs>
        {me.isError ? (
          <ErrorState offline={toApiError(me.error).code === 'NETWORK_ERROR'} message="We could not load your profile." onRetry={() => void me.refetch()} />
        ) : (
          <AppLoader label="Loading your arena" />
        )}
      </Screen>
    );
  }

  const stats = user.stats;
  const pct = levelProgress(stats.xp, stats.xpForCurrentLevel, stats.xpForNextLevel);
  const liveGame = onlineGame && !isTerminal(onlineGame) ? onlineGame : null;

  return (
    <Screen tabs scroll={false} padded={false} testID="home-screen">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
      >
        {offline ? (
          <View testID="offline-banner" accessibilityRole="alert" style={[styles.banner, { backgroundColor: c.warning + '26', borderColor: c.warning + '66' }]}>
            <WifiOff size={16} color={c.warning} />
            <Text style={[type.smallStrong, { color: c.text, flex: 1 }]}>You are offline. Offline games still work; online features need a connection.</Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <Pressy accessibilityLabel="Open profile" onPress={() => goTab('ProfileTab')} style={[styles.row, { flex: 1, minWidth: 0 }]}>
            <AppAvatar avatarId={user.avatar} name={user.displayName} size="md" status={offline ? 'offline' : 'online'} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text numberOfLines={1} style={[type.heading, { color: c.text }]}>{user.displayName}</Text>
              <Text testID="home-level" style={[type.small, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>
                Level {stats.level} · {stats.points} pts
              </Text>
              <View testID="xp-bar" accessibilityLabel={`${stats.xp} of ${stats.xpForNextLevel} XP`} style={[styles.xpTrack, { backgroundColor: c.bgCard }]}>
                <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: c.accent, borderRadius: 3 }} />
              </View>
            </View>
          </Pressy>
          <View style={styles.row}>
            <Pressy accessibilityLabel={`${user.wallet.coins} coins, open daily rewards`} onPress={() => nav.navigate('daily_rewards')} style={[styles.coins, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <Coins size={16} color={c.warning} />
              <Text style={[type.num, { fontSize: 13, color: c.text }]}>{user.wallet.coins}</Text>
            </Pressy>
            <Pressy testID="home-notifications" accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'} onPress={() => nav.navigate('notifications')} style={[styles.iconBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <Bell size={20} color={c.textSecondary} />
              {unread > 0 ? (
                <View style={[styles.badge, { backgroundColor: c.danger }]}>
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </Pressy>
            <Pressy accessibilityLabel="Settings" onPress={() => nav.navigate('settings')} style={[styles.iconBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <Settings size={20} color={c.textSecondary} />
            </Pressy>
          </View>
        </View>

        {liveGame ? (
          <AppCard testID="return-game-card" selected style={{ gap: 12 }}>
            <Text style={[type.subheading, { color: c.text }]}>Online game in progress</Text>
            <Text style={[type.small, { color: c.textSecondary }]}>Your opponent is waiting. Jump back in.</Text>
            <AppButton testID="return-game" title="Return to game" size="md" icon={<Play size={16} color="#FFFFFF" />} onPress={() => nav.navigate('online_board', { gameId: liveGame.id })} />
          </AppCard>
        ) : null}

        {active ? (
          <AppCard testID="resume-card" style={{ gap: 12 }}>
            <Text style={[type.subheading, { color: c.text }]}>Resume match</Text>
            <Text style={[type.small, { color: c.textSecondary }]}>
              {active.p1Name} vs {active.state.mode === 'VS_AI' ? 'AI' : active.p2Name} · {active.state.config.size}x{active.state.config.size} · {active.state.moves.length} moves played
            </Text>
            <View style={styles.row}>
              <AppButton testID="resume-match" title="Resume match" size="md" icon={<RotateCcw size={16} color="#FFFFFF" />} onPress={resume} />
              <AppButton testID="discard-match" title="Discard" size="md" variant="ghost" onPress={discard} />
            </View>
          </AppCard>
        ) : null}

        <LinearHero>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[type.headline, { color: c.text }]}>Ready to Play</Text>
              <Text style={[type.small, { color: c.textSecondary, marginTop: 2 }]}>Win streak {stats.currentStreak} · Classic 3x3 & Tactical 5x5</Text>
            </View>
            <View style={styles.row}>
              <SymbolMark value="X" size="md" />
              <SymbolMark value="O" size="md" />
            </View>
          </View>
          <AppButton testID="home-play" title="Play Game" fullWidth icon={<Play size={16} color="#FFFFFF" />} onPress={() => goTab('PlayTab')} />
        </LinearHero>

        {isGuest ? (
          <AppCard testID="upgrade-card" style={{ gap: 12 }}>
            <View style={styles.row}>
              <UserPlus size={20} color={c.accent} />
              <Text style={[type.subheading, { color: c.text, flex: 1 }]}>Upgrade account</Text>
            </View>
            <Text style={[type.small, { color: c.textSecondary }]}>You are playing as a guest. Create an account to keep your progress, rankings and friends on any device.</Text>
            <AppButton testID="upgrade-account" title="Upgrade account" size="md" variant="secondary" onPress={() => nav.navigate('registration')} />
          </AppCard>
        ) : null}

        <View style={{ gap: 10 }}>
          <Text style={[type.subheading, { color: c.textSecondary }]}>Game Modes</Text>
          <GameModeCard title="Offline Game" description="Play vs AI or pass-and-play locally" metaText="3x3, 4x4 & 5x5 · No internet needed" icon={<Cpu size={20} color={c.text} />} onPress={() => nav.navigate('player_setup', { mode: 'LOCAL_2P' })} />
          <GameModeCard title="Online Multiplayer" description="Quick Match, Private Rooms & Friends" metaText="Ranked · Earn rating" icon={<Globe size={20} color="#FFFFFF" />} featured onPress={() => (offline ? toast.warning('You are offline', 'Connect to the internet to play online.') : nav.navigate('online_lobby'))} />
        </View>

        <View style={styles.grid}>
          <Shortcut label="Leaderboard" sub="Global rankings" color={c.warning} icon={Trophy} onPress={() => goTab('RankingTab')} />
          <Shortcut label="Friends" sub="Play together" color={c.accentSecondary} icon={Users} onPress={() => goTab('FriendsTab')} />
          <Shortcut label="Daily Rewards" sub="Claim coins" color={c.o} icon={Gift} onPress={() => nav.navigate('daily_rewards')} />
          <Shortcut label="Achievements" sub="Track progress" color={c.accent} icon={Award} onPress={() => nav.navigate('achievements')} />
        </View>

        <View style={styles.row} testID="home-stats">
          <ScoreCard label="Total Wins" value={stats.wins} tone="success" />
          <ScoreCard label="Losses" value={stats.losses} />
          <ScoreCard label="Draws" value={stats.draws} />
        </View>
        <View style={styles.row}>
          <ScoreCard label="Matches" value={stats.totalGames} subtext="Online & AI" />
          <ScoreCard label="Win Rate" value={`${Math.round(stats.winPercentage)}%`} tone="accent" />
        </View>
        <AppButton title="View Offline Match History" variant="ghost" size="md" fullWidth icon={<History size={16} color={c.textSecondary} />} onPress={() => nav.navigate('offline_history')} />
      </ScrollView>
    </Screen>
  );
};

const LinearHero: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const c = useTheme();
  return <View style={[styles.hero, { backgroundColor: c.bgCard, borderColor: c.accent + '80' }]}>{children}</View>;
};

const Shortcut: React.FC<{ label: string; sub: string; color: string; icon: React.ComponentType<{ size?: number; color?: string }>; onPress: () => void }> = ({ label, sub, color, icon: Icon, onPress }) => {
  const c = useTheme();
  return (
    <View style={{ width: '48.5%' }}>
      <AppCard onPress={onPress} padding="sm" accessibilityLabel={label} style={styles.row}>
        <View style={[styles.shortcutIcon, { backgroundColor: color + '26' }]}>
          <Icon size={20} color={color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[type.smallStrong, { color: c.text, fontFamily: fonts.display.semibold }]}>{label}</Text>
          <Text numberOfLines={1} style={[type.caption, { color: c.textSecondary }]}>{sub}</Text>
        </View>
      </AppCard>
    </View>
  );
};

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 24, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  xpTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  coins: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontFamily: fonts.body.bold },
  hero: { borderRadius: 24, borderWidth: 1, padding: 20, gap: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  shortcutIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
