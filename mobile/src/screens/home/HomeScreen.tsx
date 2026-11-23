import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WifiOff } from 'lucide-react-native';
import { GuestUpgradeModal } from '../../components/auth/GuestUpgradeModal';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { withAlpha } from '../../design-system/colors';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useDailyReward, useLeaderboard, useMe, useNotifications, useStreaks } from '../../hooks/queries';
import { useAppNav } from '../../navigation/useAppNav';
import { toApiError } from '../../services/api/errors';
import { ActiveLocalGame, localGameStorage } from '../../services/storage/localGameStorage';
import { useAuthStore, useIsGuest } from '../../store/authStore';
import { useLocalGameStore } from '../../store/localGameStore';
import { isTerminal, useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';
import { divisionForPoints } from '../social/LeagueTiersScreen';
import {
  ACCENT_SOFT,
  BellIcon,
  BotIcon,
  ChevronIcon,
  CoinIcon,
  FlameIcon,
  GlobeIcon,
  MarkX,
  MUTED,
  ProtoButton,
  SUBTLE,
  UsersIcon,
  WARNING,
  WARNING_BORDER,
  WARNING_SOFT,
} from '../auth/protoUi';

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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
  EXPERT: 'Expert',
  IMPOSSIBLE: 'Unbeatable',
};

const TABULAR = ['tabular-nums' as const];

export const HomeScreen: React.FC = () => {
  const c = useTheme();
  const { nav, goTab } = useAppNav();
  const me = useMe();
  const notifications = useNotifications();
  const streaks = useStreaks();
  const leaderboard = useLeaderboard('global');
  const reward = useDailyReward();
  const offline = useAuthStore((s) => s.offline);
  const isGuest = useIsGuest();
  const onlineGame = useOnlineStore((s) => s.game);
  const { active, clear } = useInterruptedMatch();
  const [refreshing, setRefreshing] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const user = me.data;
  const unread = notifications.data?.unread ?? 0;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([me.refetch(), notifications.refetch(), streaks.refetch(), leaderboard.refetch(), reward.refetch()]);
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

  const openOnline = () => {
    if (offline) {
      toast.warning('You are offline', 'Connect to the internet to play online.');
      return;
    }
    if (isGuest) {
      setUpgradeOpen(true);
      return;
    }
    nav.navigate('online_lobby');
  };

  if (!user) {
    return (
      <Screen tabs>
        {me.isError ? (
          <ErrorState
            offline={toApiError(me.error).code === 'NETWORK_ERROR'}
            message="We could not load your profile."
            onRetry={() => void me.refetch()}
          />
        ) : (
          <AppLoader label="Loading your arena" />
        )}
      </Screen>
    );
  }

  const stats = user.stats;
  const liveGame = onlineGame && !isTerminal(onlineGame) ? onlineGame : null;
  const division = divisionForPoints(stats.points);

  // Season snapshot: wins are lifetime, the rate covers the recent online/AI games the server reports,
  // rank is the live global leaderboard position.
  const form = streaks.data?.recentForm ?? [];
  const formWins = form.filter((r) => r === 'WIN').length;
  const rate = form.length ? `${Math.round((formWins / form.length) * 100)}%` : '—';
  const rank = leaderboard.data?.me?.rank;

  const card = [styles.card, { backgroundColor: c.bgCard, borderColor: c.border }];

  return (
    <Screen tabs scroll={false} padded={false} gap={0} testID="home-screen">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
      >
        {offline ? (
          <View
            testID="offline-banner"
            accessibilityRole="alert"
            style={[styles.banner, { backgroundColor: withAlpha(c.warning, 0.16), borderColor: withAlpha(c.warning, 0.4) }]}
          >
            <WifiOff size={14} color={c.warning} />
            <Text style={[styles.bannerText, { color: c.text }]}>
              You are offline. Offline games still work; online features need a connection.
            </Text>
          </View>
        ) : null}

        {/* Greeting + streak + coins + bell */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: c.textSecondary }]}>{getGreeting()}</Text>
            <Text numberOfLines={1} style={[styles.name, { color: c.text }]}>{user.displayName}</Text>
          </View>
          <View style={styles.pills}>
            <View style={[styles.pill, { backgroundColor: WARNING_SOFT, borderColor: WARNING_BORDER }]} accessibilityLabel={`${stats.currentStreak} day streak`}>
              <FlameIcon size={12} />
              <Text style={[styles.pillText, { color: WARNING }]}>{stats.currentStreak}d</Text>
            </View>
            <Pressy
              accessibilityLabel={`${user.wallet.coins} coins, open daily rewards`}
              onPress={() => nav.navigate('daily_rewards')}
              style={[styles.pill, { backgroundColor: c.bgCard, borderColor: c.border }]}
            >
              <CoinIcon size={12} />
              <Text style={[styles.pillText, { color: c.text }]}>{user.wallet.coins.toLocaleString()}</Text>
            </Pressy>
            <Pressy
              testID="home-notifications"
              accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              onPress={() => nav.navigate('notifications')}
              hitSlop={8}
              style={[styles.bell, { backgroundColor: c.bgCard, borderColor: c.border }]}
            >
              <BellIcon size={15} color={c.text} />
              {unread > 0 ? <View style={[styles.bellDot, { backgroundColor: c.accent }]} /> : null}
            </Pressy>
          </View>
        </View>

        {/* Active match card */}
        {active ? (
          <View testID="resume-card" style={card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.overline, { color: c.accent }]}>IN PROGRESS • MOVE {active.state.moves.length}</Text>
                <Text style={[styles.cardTitle, { color: c.text }]}>
                  Resume vs{' '}
                  {active.state.mode === 'VS_AI'
                    ? `AI (${DIFFICULTY_LABEL[active.state.difficulty ?? 'MEDIUM'] ?? 'Medium'})`
                    : active.p2Name}
                </Text>
              </View>
              <View style={styles.cardMark}><MarkX size={16} stroke={2.4} /></View>
            </View>
            <ProtoButton testID="resume-match" title="Resume Match" height={36} fontSize={12.5} onPress={resume} />
            <Pressy testID="discard-match" accessibilityLabel="Discard" onPress={() => void discard()} hitSlop={10} style={styles.discard}>
              <Text style={[styles.discardText, { color: c.textSecondary }]}>Discard</Text>
            </Pressy>
          </View>
        ) : liveGame ? (
          <View testID="return-game-card" style={card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.overline, { color: c.accent }]}>ONLINE GAME IN PROGRESS • MOVE {liveGame.moveCount}</Text>
                <Text style={[styles.cardTitle, { color: c.text }]}>Return to your match</Text>
              </View>
              <View style={styles.cardMark}><MarkX size={16} stroke={2.4} /></View>
            </View>
            <ProtoButton
              testID="return-game"
              title="Return to Game"
              height={36}
              fontSize={12.5}
              onPress={() => nav.navigate('online_board', { gameId: liveGame.id })}
            />
          </View>
        ) : (
          <View style={card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.overline, { color: c.accent }]}>READY TO PLAY</Text>
                <Text style={[styles.cardTitle, { color: c.text }]}>Start a quick match</Text>
              </View>
              <View style={styles.cardMark}><MarkX size={16} stroke={2.4} /></View>
            </View>
            <ProtoButton testID="home-play" title="Quick Play" height={36} fontSize={12.5} onPress={() => goTab('PlayTab')} />
          </View>
        )}

        {/* Mode group */}
        <View style={[styles.group, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <ModeRow
            label="Play vs AI"
            sub="Casual, Tactical & Unbeatable"
            icon={<BotIcon size={15} />}
            iconBg={ACCENT_SOFT}
            onPress={() => nav.navigate('ai_difficulty')}
          />
          <ModeRow
            label="Online Arena"
            sub="Ranked 1v1 & Private Rooms"
            icon={<GlobeIcon size={15} />}
            iconBg={ACCENT_SOFT}
            divider
            onPress={openOnline}
          />
          <ModeRow
            label="Pass & Play"
            sub="2-player local on one device"
            icon={<UsersIcon size={15} />}
            iconBg={SUBTLE}
            divider
            onPress={() => nav.navigate('board_selection', { mode: 'LOCAL_2P' })}
          />
        </View>

        {/* Season snapshot */}
        <Pressy
          testID="home-stats"
          accessibilityLabel="Season snapshot, view division ranking"
          onPress={() => nav.navigate('league_tiers')}
          style={[styles.snapshot, { backgroundColor: c.bgCard, borderColor: c.border }]}
        >
          <View style={styles.snapCol}>
            <Text style={[styles.snapVal, { color: c.text }]}>{stats.wins} Wins</Text>
            <Text style={[styles.snapLabel, { color: MUTED }]}>All time</Text>
          </View>
          <View style={[styles.snapCol, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.border }]}>
            <Text style={[styles.snapVal, { color: c.accent }]}>{rate} Rate</Text>
            <Text style={[styles.snapLabel, { color: MUTED }]}>{form.length ? `Last ${form.length}` : 'No games yet'}</Text>
          </View>
          <View style={styles.snapCol}>
            <Text style={[styles.snapVal, { color: c.text }]}>{rank ? `#${rank}` : '—'} Rank</Text>
            <Text style={[styles.snapLabel, { color: MUTED }]}>{division.name}</Text>
          </View>
        </Pressy>

        {/* Quick pills */}
        <View style={styles.quickRow}>
          <Pressy
            accessibilityLabel="Daily Rewards"
            onPress={() => nav.navigate('daily_rewards')}
            style={[styles.quick, { backgroundColor: c.bgCard, borderColor: c.border }]}
          >
            <Text style={[styles.quickText, { color: c.text }]}>Daily Rewards</Text>
            {reward.data?.canClaim ? <View testID="reward-dot" style={[styles.rewardDot, { backgroundColor: c.accent }]} /> : null}
          </Pressy>
          <Pressy
            accessibilityLabel="Match History"
            onPress={() => nav.navigate('offline_history')}
            style={[styles.quick, { backgroundColor: c.bgCard, borderColor: c.border }]}
          >
            <Text style={[styles.quickText, { color: c.text }]}>Match History</Text>
            <ChevronIcon size={13} />
          </Pressy>
        </View>
      </ScrollView>

      <GuestUpgradeModal
        open={upgradeOpen}
        coins={user.wallet.coins}
        onUpgrade={() => {
          setUpgradeOpen(false);
          nav.navigate('registration');
        }}
        onDismiss={() => setUpgradeOpen(false)}
      />
    </Screen>
  );
};

const ModeRow: React.FC<{
  label: string;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  divider?: boolean;
  onPress: () => void;
}> = ({ label, sub, icon, iconBg, divider, onPress }) => {
  const c = useTheme();
  return (
    <Pressy
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={1}
      style={[styles.modeRow, divider ? { borderTopWidth: 1, borderTopColor: c.border } : null]}
    >
      <View style={styles.modeLeft}>
        <View style={[styles.modeIcon, { backgroundColor: iconBg }]}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.modeTitle, { color: c.text }]}>{label}</Text>
          <Text style={[styles.modeSub, { color: c.textSecondary }]}>{sub}</Text>
        </View>
      </View>
      <ChevronIcon size={13} />
    </Pressy>
  );
};

const SHADOW = { shadowColor: '#141518', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.035, shadowRadius: 8, elevation: 1 } as const;

const styles = StyleSheet.create({
  body: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 10 },
  bannerText: { fontFamily: fonts.body.medium, fontSize: 11.5, flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontFamily: fonts.body.regular, fontSize: 11, lineHeight: 15 },
  name: { fontFamily: fonts.body.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.34 },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pillText: { fontFamily: fonts.body.semibold, fontSize: 10.5, lineHeight: 14, fontVariant: TABULAR },
  bell: { width: 28, height: 28, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3 },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8, ...SHADOW },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overline: { fontFamily: fonts.body.semibold, fontSize: 9.5, lineHeight: 13, letterSpacing: 0.5 },
  cardTitle: { fontFamily: fonts.body.semibold, fontSize: 14, lineHeight: 19, marginTop: 2 },
  cardMark: { width: 32, height: 32, borderRadius: 9, backgroundColor: ACCENT_SOFT, alignItems: 'center', justifyContent: 'center' },
  discard: { alignSelf: 'center' },
  discardText: { fontFamily: fonts.body.semibold, fontSize: 11 },
  group: { borderWidth: 1, borderRadius: 14, overflow: 'hidden', ...SHADOW },
  modeRow: { minHeight: 36, paddingHorizontal: 13, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modeLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  modeIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontFamily: fonts.body.semibold, fontSize: 12.5, lineHeight: 17 },
  modeSub: { fontFamily: fonts.body.regular, fontSize: 10, lineHeight: 14 },
  snapshot: { borderWidth: 1, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 8, flexDirection: 'row', ...SHADOW },
  snapCol: { flex: 1, alignItems: 'center' },
  snapVal: { fontFamily: fonts.body.semibold, fontSize: 12.5, lineHeight: 17, fontVariant: TABULAR },
  snapLabel: { fontFamily: fonts.body.regular, fontSize: 9.5, lineHeight: 13 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quick: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickText: { fontFamily: fonts.body.semibold, fontSize: 11.5, lineHeight: 16 },
  rewardDot: { width: 8, height: 8, borderRadius: 4 },
});
