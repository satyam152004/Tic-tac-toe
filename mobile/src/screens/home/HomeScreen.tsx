import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bot, ChevronRight, Gift, Globe, History, Smartphone, Users, WifiOff } from 'lucide-react-native';
import { GuestUpgradeModal } from '../../components/auth/GuestUpgradeModal';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { SymbolMark } from '../../components/game/SymbolMark';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { withAlpha } from '../../design-system/colors';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useDailyReward, useLeaderboard, useMe, useNotifications, useStreaks } from '../../hooks/queries';
import type { RootStackParamList } from '../../navigation/types';
import { isPreStart, matchFoundSource } from '../../services/gameRoute';
import { ChallengeList } from '../social/ChallengeList';
import { useAppNav } from '../../navigation/useAppNav';
import { toApiError } from '../../services/api/errors';
import { ActiveLocalGame, localGameStorage } from '../../services/storage/localGameStorage';
import { useAuthStore, useIsGuest } from '../../store/authStore';
import { useLocalGameStore } from '../../store/localGameStore';
import { isTerminal, useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';
import {
  ACCENT_SOFT,
  BellIcon,
  CoinIcon,
  FlameIcon,
  MarkX,
  ProtoButton,
  WARNING,
  WARNING_BORDER,
  WARNING_SOFT,
} from '../auth/protoUi';

import { fs, ms, ch } from '../../design-system/responsive';
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

/** Decorative sample position for the idle "Ready to play" board (not interactive). */
const PREVIEW_BOARD: Array<'X' | 'O' | null> = ['X', null, 'O', null, 'X', null, null, null, 'O'];

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
      toast.error("Couldn't discard match");
    }
  };

  // Play online and Play with friends both go to the setup screen, then Match found, then the board.
  const openOnlineSetup = (params: RootStackParamList['match_setup']) => {
    if (offline) {
      toast.warning('You are offline', 'Connect to the internet to play online.');
      return;
    }
    if (isGuest) {
      setUpgradeOpen(true);
      return;
    }
    nav.navigate('match_setup', params);
  };
  const openOnline = () => openOnlineSetup({ mode: 'ONLINE', purpose: 'QUICK' });
  const openFriends = () => openOnlineSetup({ mode: 'ONLINE', purpose: 'FRIEND' });

  if (!user) {
    return (
      <Screen tabs>
        {me.isError ? (
          <ErrorState
            offline={toApiError(me.error).code === 'NETWORK_ERROR'}
            message="Couldn't load your profile."
            onRetry={() => void me.refetch()}
          />
        ) : (
          <AppLoader label="Loading..." />
        )}
      </Screen>
    );
  }

  const stats = user.stats;
  const liveGame = onlineGame && !isTerminal(onlineGame) ? onlineGame : null;

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
            <WifiOff size={ms(18)} color={c.warning} />
            <Text style={[styles.bannerText, { color: c.text }]}>
              You're offline. Offline games still work. Online play needs internet.
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
              <FlameIcon size={ms(15)} />
              <Text style={[styles.pillText, { color: WARNING }]}>{stats.currentStreak}d</Text>
            </View>
            <Pressy
              accessibilityLabel={`${user.wallet.coins} coins, open daily rewards`}
              onPress={() => nav.navigate('daily_rewards')}
              style={[styles.pill, { backgroundColor: c.bgCard, borderColor: c.border }]}
            >
              <CoinIcon size={ms(15)} />
              <Text style={[styles.pillText, { color: c.text }]}>{user.wallet.coins.toLocaleString()}</Text>
            </Pressy>
            <Pressy
              testID="home-notifications"
              accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              onPress={() => nav.navigate('notifications')}
              hitSlop={6}
              style={[styles.bell, { backgroundColor: c.bgCard, borderColor: c.border }]}
            >
              <BellIcon size={ms(20)} color={c.text} />
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
              <View style={styles.cardMark}><MarkX size={ms(20)} stroke={2.4} /></View>
            </View>
            <ProtoButton testID="resume-match" title="Resume Match" height={36} fontSize={fs(12.5)} onPress={resume} />
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
              <View style={styles.cardMark}><MarkX size={ms(20)} stroke={2.4} /></View>
            </View>
            <ProtoButton
              testID="return-game"
              title="Return to Game"
              height={36}
              fontSize={fs(12.5)}
              onPress={() =>
                isPreStart(liveGame)
                  ? nav.navigate('match_found', { gameId: liveGame.id, source: matchFoundSource(liveGame.type) })
                  : nav.navigate('online_board', { gameId: liveGame.id })
              }
            />
          </View>
        ) : (
          <View style={[...card, styles.idle]}>
            <View testID="home-board" style={styles.board} accessibilityLabel="Tic tac toe board preview">
              {PREVIEW_BOARD.map((value, i) => (
                <View key={i} style={styles.cell}>
                  <View style={[styles.tile, { backgroundColor: withAlpha(c.text, 0.05) }]}>
                    {value ? <SymbolMark value={value} size="md" animate={false} /> : null}
                  </View>
                </View>
              ))}
            </View>
            <ProtoButton testID="home-play" title="Quick play" height={48} fontSize={fs(15)} onPress={() => nav.navigate('match_setup', { mode: 'VS_AI' })} />
          </View>
        )}

        {/* Friend challenges waiting for an answer (shows nothing when there are none) */}
        <ChallengeList />

        {/* Mode tiles */}
        <View style={styles.modeGrid}>
          <ModeTile testID="home-play-online" label="Play online" icon={<Globe size={ms(24)} color={c.accent} />} onPress={openOnline} />
          <ModeTile testID="home-play-friends" label="Play with friends" icon={<Users size={ms(24)} color={c.success} />} onPress={openFriends} />
          <ModeTile testID="home-computer" label="Computer" icon={<Bot size={ms(24)} color={c.accentSecondary} />} onPress={() => nav.navigate('match_setup', { mode: 'VS_AI' })} />
          <ModeTile testID="home-pass-play" label="Pass n play" icon={<Smartphone size={ms(24)} color={c.danger} />} onPress={() => nav.navigate('match_setup', { mode: 'LOCAL_2P' })} />
        </View>

        {/* Stats row: wins | losses | draws | streak */}
        <View testID="home-stats" style={styles.statsRow}>
          {[
            { label: 'Wins', value: stats.wins },
            { label: 'Losses', value: stats.losses },
            { label: 'Draws', value: stats.draws },
            { label: 'Streak', value: stats.currentStreak },
          ].map((s, i) => (
            <View
              key={s.label}
              accessibilityLabel={`${s.label} ${s.value}`}
              style={[styles.statCell, { backgroundColor: c.bgCard, borderColor: c.border }]}
            >
              <Text style={[styles.statValue, { color: c.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick links */}
        <View style={styles.quickRow}>
          <Pressy
            accessibilityLabel="Daily Rewards"
            onPress={() => nav.navigate('daily_rewards')}
            style={[styles.quick, { backgroundColor: c.bgCard, borderColor: c.border }]}
          >
            <View style={styles.quickLeft}>
              <Gift size={ms(18)} color={c.warning} />
              <Text style={[styles.quickText, { color: c.text }]}>Daily rewards</Text>
            </View>
            {reward.data?.canClaim ? <View testID="reward-dot" style={[styles.rewardDot, { backgroundColor: c.accent }]} /> : null}
          </Pressy>
          <Pressy
            accessibilityLabel="Match History"
            onPress={() => nav.navigate('offline_history')}
            style={[styles.quick, { backgroundColor: c.bgCard, borderColor: c.border }]}
          >
            <View style={styles.quickLeft}>
              <History size={ms(18)} color={c.text} />
              <Text style={[styles.quickText, { color: c.text }]}>Match history</Text>
            </View>
            <ChevronRight size={ms(16)} color={c.text} />
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

const SHADOW = { shadowColor: '#141518', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.035, shadowRadius: 8, elevation: 1 } as const;

const ModeTile: React.FC<{ label: string; icon: React.ReactNode; onPress: () => void; testID?: string }> = ({ label, icon, onPress, testID }) => {
  const c = useTheme();
  return (
    <Pressy
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.modeTile, { backgroundColor: c.bgCard, borderColor: c.border }]}
    >
      {icon}
      <Text style={[styles.modeTileText, { color: c.text }]}>{label}</Text>
    </Pressy>
  );
};

const styles = StyleSheet.create({
  body: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: ms(12) },
  bannerText: { fontFamily: fonts.body.medium, fontSize: fs(12), lineHeight: Math.round(fs(12) * 1.3), flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontFamily: fonts.body.regular, fontSize: fs(12), lineHeight: Math.round(fs(12) * 1.3) },
  name: { fontFamily: fonts.body.semibold, fontSize: fs(17), lineHeight: Math.round(fs(17) * 1.3), letterSpacing: -0.34 },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  pill: { paddingHorizontal: ms(10), paddingVertical: 6, minHeight: ms(32), borderRadius: 9999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pillText: { fontFamily: fonts.body.semibold, fontSize: fs(10.5), lineHeight: Math.round(fs(10.5) * 1.3), fontVariant: TABULAR },
  bell: { width: ms(36), height: ms(36), borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: ms(8), right: ms(8), width: ms(7), height: ms(7), borderRadius: 4 },
  card: { borderWidth: 1, borderRadius: 14, padding: ms(14), gap: 10, ...SHADOW },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overline: { fontFamily: fonts.body.semibold, fontSize: fs(10), lineHeight: Math.round(fs(10) * 1.3), letterSpacing: 0.5 },
  cardTitle: { fontFamily: fonts.body.semibold, fontSize: fs(14), lineHeight: Math.round(fs(14) * 1.3), marginTop: 2 },
  cardMark: { width: ms(38), height: ms(38), borderRadius: 11, backgroundColor: ACCENT_SOFT, alignItems: 'center', justifyContent: 'center' },
  discard: { alignSelf: 'center', minHeight: 28, justifyContent: 'center' },
  discardText: { fontFamily: fonts.body.semibold, fontSize: fs(12.5) },
  group: { borderWidth: 1, borderRadius: 14, overflow: 'hidden', ...SHADOW },
  modeRow: { minHeight: ch(44), paddingHorizontal: ms(14), paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modeLeft: { flexDirection: 'row', alignItems: 'center', gap: ms(12), flex: 1 },
  modeIcon: { width: ms(36), height: ms(36), borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontFamily: fonts.body.semibold, fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.3) },
  modeSub: { fontFamily: fonts.body.regular, fontSize: fs(11), lineHeight: Math.round(fs(11) * 1.3) },
  quickRow: { flexDirection: 'row', gap: 10 },
  quick: { flex: 1, paddingHorizontal: ms(12), paddingVertical: 8, minHeight: ch(40), borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickText: { fontFamily: fonts.body.semibold, fontSize: fs(11.5), lineHeight: Math.round(fs(11.5) * 1.3) },
  rewardDot: { width: ms(9), height: ms(9), borderRadius: 5 },
  idle: { gap: 12, alignItems: 'stretch' },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCell: { flex: 1, alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 12, paddingVertical: 10, ...SHADOW },
  statValue: { fontFamily: fonts.body.semibold, fontSize: fs(15), lineHeight: Math.round(fs(15) * 1.2), fontVariant: TABULAR },
  statLabel: { fontFamily: fonts.body.regular, fontSize: fs(10.5), lineHeight: Math.round(fs(10.5) * 1.3) },
  board: { alignSelf: 'center', width: '100%', maxWidth: ch(220), aspectRatio: 1, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.3333%', height: '33.3333%', padding: ms(4) },
  tile: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modeTile: { width: '48%', minHeight: ch(92), borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, padding: ms(10), ...SHADOW },
  modeTileText: { fontFamily: fonts.body.semibold, fontSize: fs(12.5), lineHeight: Math.round(fs(12.5) * 1.3), textAlign: 'center' },
  quickLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
});
