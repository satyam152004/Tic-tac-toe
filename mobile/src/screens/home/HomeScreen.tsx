import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Bell,
  ChevronRight,
  Coins,
  Cpu,
  Flame,
  Globe,
  RotateCcw,
  UserPlus,
  Users,
  WifiOff,
} from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { SymbolMark } from '../../components/game/SymbolMark';
import { withAlpha } from '../../design-system/colors';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useMe, useNotifications } from '../../hooks/queries';
import { useAppNav } from '../../navigation/useAppNav';
import { toApiError } from '../../services/api/errors';
import { ActiveLocalGame, localGameStorage } from '../../services/storage/localGameStorage';
import { useAuthStore, useIsGuest } from '../../store/authStore';
import { useLocalGameStore } from '../../store/localGameStore';
import { isTerminal, useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';
import { divisionForPoints } from '../social/LeagueTiersScreen';

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

  // Responsive device metrics
  const { height: screenH } = useWindowDimensions();
  const isTall = screenH >= 780;
  const isVeryTall = screenH >= 860;
  const isCompact = screenH < 700;

  // Responsive scaling tokens
  const bodyGap = isVeryTall ? 20 : isTall ? 17 : 13;
  const bodyPadTop = isVeryTall ? 16 : isTall ? 12 : 8;
  const bodyPadBottom = isVeryTall ? 36 : isTall ? 28 : 20;
  const bodyPadH = isVeryTall ? 22 : 20;

  // Header tokens
  const greetingSize = isTall ? 13 : 11.5;
  const nameSize = isVeryTall ? 25 : isTall ? 22 : 19;
  const levelSize = isTall ? 12 : 10.5;
  const badgeH = isVeryTall ? 38 : isTall ? 35 : 32;
  const badgeFontSize = isTall ? 12.5 : 11;
  const bellSize = isVeryTall ? 38 : isTall ? 35 : 32;
  const bellIconSize = isTall ? 18 : 15;

  // Active / Ready to Play card tokens
  const cardRadius = isTall ? 18 : 14;
  const cardPad = isVeryTall ? 20 : isTall ? 18 : 14;
  const cardOverlineSize = isTall ? 11.5 : 10;
  const cardTitleSize = isVeryTall ? 19 : isTall ? 17 : 14.5;
  const markSquircleSize = isVeryTall ? 48 : isTall ? 44 : 36;
  const markSymbolSize = isVeryTall ? 26 : isTall ? 24 : 18;
  const primaryBtnH = isVeryTall ? 50 : isTall ? 46 : 40;

  // Mode Group tokens
  const groupRowMinH = isVeryTall ? 68 : isTall ? 62 : 52;
  const groupRowPadV = isVeryTall ? 15 : isTall ? 13 : 10;
  const groupIconSquircleSize = isVeryTall ? 40 : isTall ? 36 : 30;
  const groupIconSize = isVeryTall ? 20 : isTall ? 18 : 15;
  const groupTitleSize = isVeryTall ? 16 : isTall ? 15 : 13.5;
  const groupSubSize = isVeryTall ? 12.5 : isTall ? 12 : 10.5;
  const chevronSize = isTall ? 16 : 14;
  const dividerMarginL = isVeryTall ? 64 : isTall ? 58 : 48;

  // Snapshot card tokens
  const snapshotPadV = isVeryTall ? 18 : isTall ? 15 : 11;
  const snapshotValSize = isVeryTall ? 17.5 : isTall ? 16 : 13.5;
  const snapshotLabelSize = isTall ? 12 : 10.5;

  // Quick pills tokens
  const pillH = isVeryTall ? 54 : isTall ? 48 : 42;
  const pillTextSize = isVeryTall ? 14 : isTall ? 13.5 : 12;

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

  return (
    <Screen tabs scroll={false} padded={false} testID="home-screen">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.body,
          {
            paddingHorizontal: bodyPadH,
            paddingTop: bodyPadTop,
            paddingBottom: bodyPadBottom,
            gap: bodyGap,
            flexGrow: 1,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
      >
        {/* Offline Banner */}
        {offline ? (
          <View
            testID="offline-banner"
            accessibilityRole="alert"
            style={[
              styles.banner,
              {
                borderRadius: cardRadius - 2,
                backgroundColor: withAlpha(c.warning, 0.16),
                borderColor: withAlpha(c.warning, 0.4),
                padding: isTall ? 12 : 10,
              },
            ]}
          >
            <WifiOff size={isTall ? 16 : 14} color={c.warning} />
            <Text style={[styles.bannerText, { color: c.text, fontSize: isTall ? 12.5 : 11.5 }]}>
              You are offline. Offline games still work; online features need a connection.
            </Text>
          </View>
        ) : null}

        {/* 1. Header Bar: Greeting + Streak + Coins + Bell */}
        <View style={styles.headerRow}>
          <View style={styles.greetingBlock}>
            <Text style={[styles.greetingText, { color: c.textSecondary, fontSize: greetingSize }]}>
              {getGreeting()}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.displayNameText, { color: c.text, fontSize: nameSize }]}
            >
              {user.displayName}
            </Text>
            <Text
              testID="home-level"
              style={[styles.levelSubText, { color: c.textSecondary, fontSize: levelSize }]}
            >
              Level {stats.level} · {stats.points} pts
            </Text>
          </View>

          <View style={styles.topBadgesRow}>
            {/* Streak Pill */}
            <View style={[styles.streakPill, { height: badgeH }]}>
              <Flame size={isTall ? 14 : 12} color="#B45309" fill="#B45309" />
              <Text style={[styles.streakText, { fontSize: badgeFontSize }]}>{stats.currentStreak}d</Text>
            </View>

            {/* Coins Pill */}
            <Pressy
              accessibilityLabel={`${user.wallet.coins} coins, open daily rewards`}
              onPress={() => nav.navigate('daily_rewards')}
              style={[
                styles.coinsPill,
                { height: badgeH, backgroundColor: c.bgCard, borderColor: c.border },
              ]}
            >
              <Coins size={isTall ? 14 : 12} color="#B45309" />
              <Text style={[styles.coinsText, { color: c.text, fontSize: badgeFontSize }]}>
                {user.wallet.coins.toLocaleString()}
              </Text>
            </Pressy>

            {/* Bell Icon Button */}
            <Pressy
              testID="home-notifications"
              accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              onPress={() => nav.navigate('notifications')}
              style={[
                styles.bellBtn,
                {
                  width: bellSize,
                  height: bellSize,
                  borderRadius: isTall ? 11 : 9,
                  backgroundColor: c.bgCard,
                  borderColor: c.border,
                },
              ]}
            >
              <Bell size={bellIconSize} color={c.text} />
              {unread > 0 ? (
                <View
                  style={[
                    styles.unreadDot,
                    {
                      backgroundColor: c.accent,
                      width: isTall ? 7 : 6,
                      height: isTall ? 7 : 6,
                      borderRadius: isTall ? 3.5 : 3,
                    },
                  ]}
                />
              ) : null}
            </Pressy>
          </View>
        </View>

        {/* 2. Active Match / Ready to Play Card */}
        {active ? (
          <View
            testID="resume-card"
            style={[
              styles.card,
              {
                borderRadius: cardRadius,
                padding: cardPad,
                backgroundColor: c.bgCard,
                borderColor: c.border,
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardOverline, { color: c.accent, fontSize: cardOverlineSize }]}>
                  IN PROGRESS • MOVE {active.state.moves.length}
                </Text>
                <Text style={[styles.cardTitle, { color: c.text, fontSize: cardTitleSize }]}>
                  Resume vs {active.state.mode === 'VS_AI' ? 'AI' : active.p2Name}
                </Text>
              </View>
              <View
                style={[
                  styles.markSquircle,
                  {
                    width: markSquircleSize,
                    height: markSquircleSize,
                    borderRadius: isTall ? 12 : 9,
                    backgroundColor: withAlpha(c.accent, 0.12),
                  },
                ]}
              >
                <SymbolMark value={active.p1Mark ?? 'X'} size={markSymbolSize} animate={false} />
              </View>
            </View>
            <View style={styles.activeActionsRow}>
              <AppButton
                testID="resume-match"
                title="Resume Match"
                size={isTall ? 'lg' : 'md'}
                style={[styles.flexBtn, { height: primaryBtnH }]}
                icon={<RotateCcw size={16} color="#FFFFFF" />}
                onPress={resume}
              />
              <AppButton
                testID="discard-match"
                title="Discard"
                size={isTall ? 'lg' : 'md'}
                variant="ghost"
                onPress={discard}
              />
            </View>
          </View>
        ) : liveGame ? (
          <View
            testID="return-game-card"
            style={[
              styles.card,
              {
                borderRadius: cardRadius,
                padding: cardPad,
                backgroundColor: c.bgCard,
                borderColor: c.border,
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardOverline, { color: c.accent, fontSize: cardOverlineSize }]}>
                  ONLINE GAME IN PROGRESS
                </Text>
                <Text style={[styles.cardTitle, { color: c.text, fontSize: cardTitleSize }]}>
                  Opponent Waiting
                </Text>
              </View>
              <View
                style={[
                  styles.markSquircle,
                  {
                    width: markSquircleSize,
                    height: markSquircleSize,
                    borderRadius: isTall ? 12 : 9,
                    backgroundColor: withAlpha(c.accent, 0.12),
                  },
                ]}
              >
                <SymbolMark value="X" size={markSymbolSize} animate={false} />
              </View>
            </View>
            <View style={styles.cardBtnWrap}>
              <AppButton
                testID="return-game"
                title="Return to Game"
                size={isTall ? 'lg' : 'md'}
                fullWidth
                style={{ height: primaryBtnH }}
                onPress={() => nav.navigate('online_board', { gameId: liveGame.id })}
              />
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.card,
              {
                borderRadius: cardRadius,
                padding: cardPad,
                backgroundColor: c.bgCard,
                borderColor: c.border,
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardOverline, { color: c.accent, fontSize: cardOverlineSize }]}>
                  READY TO PLAY • SEASON 4
                </Text>
                <Text style={[styles.cardTitle, { color: c.text, fontSize: cardTitleSize }]}>
                  Ready to Play
                </Text>
              </View>
              <View
                style={[
                  styles.markSquircle,
                  {
                    width: markSquircleSize,
                    height: markSquircleSize,
                    borderRadius: isTall ? 12 : 9,
                    backgroundColor: withAlpha(c.accent, 0.12),
                  },
                ]}
              >
                <SymbolMark value="X" size={markSymbolSize} animate={false} />
              </View>
            </View>
            <View style={styles.cardBtnWrap}>
              <AppButton
                testID="home-play"
                title="Quick Play"
                size={isTall ? 'lg' : 'md'}
                fullWidth
                style={{ height: primaryBtnH }}
                onPress={() => goTab('PlayTab')}
              />
            </View>
          </View>
        )}

        {/* 3. Game Mode 3-Row Group Card (ui-group) */}
        <View
          style={[
            styles.groupCard,
            {
              borderRadius: cardRadius,
              backgroundColor: c.bgCard,
              borderColor: c.border,
            },
          ]}
        >
          {/* Row 1: Play vs AI */}
          <Pressy
            accessibilityLabel="Play vs AI"
            onPress={() => nav.navigate('player_setup', { mode: 'VS_AI' })}
            style={[styles.groupRow, { minHeight: groupRowMinH, paddingVertical: groupRowPadV }]}
          >
            <View style={styles.groupLeft}>
              <View
                style={[
                  styles.groupIconSquircle,
                  {
                    width: groupIconSquircleSize,
                    height: groupIconSquircleSize,
                    borderRadius: isTall ? 10 : 8,
                    backgroundColor: withAlpha(c.accent, 0.12),
                  },
                ]}
              >
                <Cpu size={groupIconSize} color={c.accent} />
              </View>
              <View style={styles.groupTextCol}>
                <Text style={[styles.groupTitle, { color: c.text, fontSize: groupTitleSize }]}>
                  Play vs AI
                </Text>
                <Text style={[styles.groupSubtitle, { color: c.textSecondary, fontSize: groupSubSize }]}>
                  Casual, Tactical &amp; Unbeatable
                </Text>
              </View>
            </View>
            <ChevronRight size={chevronSize} color="#8E939E" />
          </Pressy>

          <View style={[styles.groupDivider, { marginLeft: dividerMarginL, backgroundColor: c.border }]} />

          {/* Row 2: Online Arena */}
          <Pressy
            accessibilityLabel="Online Arena"
            onPress={() =>
              offline
                ? toast.warning('You are offline', 'Connect to the internet to play online.')
                : nav.navigate('online_lobby')
            }
            style={[styles.groupRow, { minHeight: groupRowMinH, paddingVertical: groupRowPadV }]}
          >
            <View style={styles.groupLeft}>
              <View
                style={[
                  styles.groupIconSquircle,
                  {
                    width: groupIconSquircleSize,
                    height: groupIconSquircleSize,
                    borderRadius: isTall ? 10 : 8,
                    backgroundColor: withAlpha(c.accent, 0.12),
                  },
                ]}
              >
                <Globe size={groupIconSize} color={c.accent} />
              </View>
              <View style={styles.groupTextCol}>
                <Text style={[styles.groupTitle, { color: c.text, fontSize: groupTitleSize }]}>
                  Online Arena
                </Text>
                <Text style={[styles.groupSubtitle, { color: c.textSecondary, fontSize: groupSubSize }]}>
                  Ranked 1v1 &amp; Private Rooms
                </Text>
              </View>
            </View>
            <ChevronRight size={chevronSize} color="#8E939E" />
          </Pressy>

          <View style={[styles.groupDivider, { marginLeft: dividerMarginL, backgroundColor: c.border }]} />

          {/* Row 3: Pass & Play */}
          <Pressy
            accessibilityLabel="Pass & Play"
            onPress={() => nav.navigate('player_setup', { mode: 'LOCAL_2P' })}
            style={[styles.groupRow, { minHeight: groupRowMinH, paddingVertical: groupRowPadV }]}
          >
            <View style={styles.groupLeft}>
              <View
                style={[
                  styles.groupIconSquircle,
                  {
                    width: groupIconSquircleSize,
                    height: groupIconSquircleSize,
                    borderRadius: isTall ? 10 : 8,
                    backgroundColor: '#F1F1EE',
                  },
                ]}
              >
                <Users size={groupIconSize} color={c.text} />
              </View>
              <View style={styles.groupTextCol}>
                <Text style={[styles.groupTitle, { color: c.text, fontSize: groupTitleSize }]}>
                  Pass &amp; Play
                </Text>
                <Text style={[styles.groupSubtitle, { color: c.textSecondary, fontSize: groupSubSize }]}>
                  2-player local on one device
                </Text>
              </View>
            </View>
            <ChevronRight size={chevronSize} color="#8E939E" />
          </Pressy>
        </View>

        {/* 4. Season Snapshot (3-Col Card) */}
        <Pressy
          testID="home-stats"
          accessibilityLabel="Season snapshot, view division ranking"
          onPress={() => nav.navigate('league_tiers')}
          style={[
            styles.snapshotCard,
            {
              borderRadius: cardRadius,
              paddingVertical: snapshotPadV,
              backgroundColor: c.bgCard,
              borderColor: c.border,
            },
          ]}
        >
          {/* Col 1: Wins */}
          <View style={styles.snapshotCol}>
            <View style={styles.statValRow}>
              <Text style={[styles.snapshotVal, { color: c.text, fontSize: snapshotValSize }]}>
                {stats.wins}
              </Text>
              <Text style={[styles.snapshotVal, { color: c.text, fontSize: snapshotValSize }]}>
                {' '}Wins
              </Text>
            </View>
            <Text style={[styles.snapshotLabel, { color: c.textSecondary, fontSize: snapshotLabelSize }]}>
              Season · <Text>{stats.totalGames}</Text> g
            </Text>
          </View>

          {/* Col 2: Win Rate (bordered) */}
          <View style={[styles.snapshotCol, styles.snapshotColBorder, { borderColor: c.border }]}>
            <Text style={[styles.snapshotVal, { color: c.accent, fontSize: snapshotValSize }]}>
              {Math.round(stats.winPercentage)}% Rate
            </Text>
            <Text style={[styles.snapshotLabel, { color: c.textSecondary, fontSize: snapshotLabelSize }]}>
              Last 20
            </Text>
          </View>

          {/* Col 3: Rank & Division */}
          <View style={styles.snapshotCol}>
            <Text style={[styles.snapshotVal, { color: c.text, fontSize: snapshotValSize }]}>
              #{stats.level > 0 ? 14 : 99} Rank
            </Text>
            <Text style={[styles.snapshotLabel, { color: c.textSecondary, fontSize: snapshotLabelSize }]}>
              {division.name}
            </Text>
          </View>
        </Pressy>

        {/* 5. Quick Pills (2-Col Grid) */}
        <View style={styles.quickPillsRow}>
          {/* Left: Daily Rewards */}
          <Pressy
            accessibilityLabel="Daily Rewards"
            onPress={() => nav.navigate('daily_rewards')}
            style={[
              styles.quickPill,
              {
                height: pillH,
                borderRadius: isTall ? 14 : 11,
                backgroundColor: c.bgCard,
                borderColor: c.border,
              },
            ]}
          >
            <Text style={[styles.quickPillText, { color: c.text, fontSize: pillTextSize }]}>
              Daily Rewards
            </Text>
            <View
              style={[
                styles.quickPillDot,
                {
                  backgroundColor: c.accent,
                  width: isTall ? 8 : 7,
                  height: isTall ? 8 : 7,
                  borderRadius: isTall ? 4 : 3.5,
                },
              ]}
            />
          </Pressy>

          {/* Right: Match History */}
          <Pressy
            accessibilityLabel="Match History"
            onPress={() => nav.navigate('offline_history')}
            style={[
              styles.quickPill,
              {
                height: pillH,
                borderRadius: isTall ? 14 : 11,
                backgroundColor: c.bgCard,
                borderColor: c.border,
              },
            ]}
          >
            <Text style={[styles.quickPillText, { color: c.text, fontSize: pillTextSize }]}>
              Match History
            </Text>
            <ChevronRight size={chevronSize} color="#8E939E" />
          </Pressy>
        </View>

        {/* Guest Upgrade Reminder (if guest) */}
        {isGuest ? (
          <View
            testID="upgrade-card"
            style={[
              styles.guestCard,
              {
                borderRadius: cardRadius - 2,
                padding: isTall ? 14 : 12,
                backgroundColor: c.bgCard,
                borderColor: c.border,
              },
            ]}
          >
            <View style={styles.guestHeader}>
              <UserPlus size={isTall ? 16 : 15} color={c.accent} />
              <Text style={[styles.guestTitle, { color: c.text, fontSize: isTall ? 13.5 : 12 }]}>
                Guest Account
              </Text>
            </View>
            <Text
              style={[
                styles.guestSubtitle,
                { color: c.textSecondary, fontSize: isTall ? 11.5 : 10.5 },
              ]}
            >
              Upgrade to keep your ELO rating, leaderboard rank and game history across devices.
            </Text>
            <AppButton
              testID="upgrade-account"
              title="Upgrade Account"
              size={isTall ? 'lg' : 'md'}
              variant="secondary"
              onPress={() => nav.navigate('registration')}
              style={[styles.guestBtn, { height: isTall ? 38 : 34 }]}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  bannerText: {
    fontFamily: fonts.body.medium,
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  greetingBlock: {
    flex: 1,
    gap: 2,
  },
  greetingText: {
    fontFamily: fonts.body.regular,
  },
  displayNameText: {
    fontFamily: fonts.body.semibold,
    letterSpacing: -0.4,
  },
  levelSubText: {
    fontFamily: fonts.mono.medium,
    marginTop: 1,
  },
  topBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  streakText: {
    fontFamily: fonts.mono.semibold,
    color: '#B45309',
  },
  coinsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  coinsText: {
    fontFamily: fonts.mono.semibold,
  },
  bellBtn: {
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  card: {
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTextCol: {
    flex: 1,
    gap: 3,
  },
  cardOverline: {
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontFamily: fonts.body.semibold,
  },
  markSquircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  flexBtn: {
    flex: 1,
  },
  cardBtnWrap: {
    marginTop: 12,
  },
  groupCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  groupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  groupIconSquircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTextCol: {
    flex: 1,
    gap: 2,
  },
  groupTitle: {
    fontFamily: fonts.body.semibold,
  },
  groupSubtitle: {
    fontFamily: fonts.body.regular,
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
  },
  snapshotCard: {
    borderWidth: 1,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  snapshotCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  snapshotColBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  statValRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  snapshotVal: {
    fontFamily: fonts.body.semibold,
  },
  snapshotLabel: {
    fontFamily: fonts.body.regular,
  },
  quickPillsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickPill: {
    flex: 1,
    paddingHorizontal: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickPillText: {
    fontFamily: fonts.body.semibold,
  },
  quickPillDot: {},
  guestCard: {
    borderWidth: 1,
    gap: 6,
  },
  guestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guestTitle: {
    fontFamily: fonts.body.semibold,
  },
  guestSubtitle: {
    fontFamily: fonts.body.regular,
    lineHeight: 16,
  },
  guestBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
});
