import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, PlusSquare, Wifi, WifiOff } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { ErrorState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
import { useMe } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { gameApi } from '../../services/api/gameApi';
import type { BoardSize } from '../../services/api/types';
import { useAuthStore } from '../../store/authStore';
import { BoardSizePicker, useSocketStatus } from './shared';

const MOCK_OPEN_ROOMS = [
  { id: 'TTT-419', host: 'Meera', size: '3×3 Classic', elo: 1490 },
  { id: 'TTT-842', host: 'Rohan', size: '4×4 Extended', elo: 1540 },
];

export const OnlineLobbyScreen: React.FC<RootScreenProps<'online_lobby'>> = () => {
  const c = useTheme();
  const { height } = useWindowDimensions();
  const isTall = height >= 780;
  const { nav, goTab, back } = useAppNav();
  const me = useMe().data;
  const authOffline = useAuthStore((s) => s.offline);
  const status = useSocketStatus();
  const [size, setSize] = useState<BoardSize>(3);
  const active = useQuery({ queryKey: ['games', 'active'], queryFn: gameApi.active, enabled: !authOffline, staleTime: 5000 });

  const offline = authOffline || status === 'closed';
  const elo = me?.stats?.points ?? 1498;
  const unfinished = (active.data ?? []).find((g) => g.status === 'IN_PROGRESS' || g.status === 'READY' || g.status === 'WAITING');

  const resume = () => {
    if (!unfinished) return;
    if (status === 'reconnecting') nav.navigate('reconnection', { gameId: unfinished.id });
    else nav.navigate('online_board', { gameId: unfinished.id });
  };

  return (
    <Screen
      title="Online Arena"
      subtitle={offline ? 'Offline' : status === 'ready' ? 'Connected' : 'Connecting...'}
      onBack={back}
      scroll={false}
      padded={false}
      rightAction={
        <View style={styles.eloBadge}>
          <Text style={[styles.eloBadgeText, { color: c.accent }]}>{elo.toLocaleString()} ELO</Text>
        </View>
      }
    >
      {offline ? (
        <View style={{ padding: 20 }}>
          <ErrorState offline message="Online play needs an internet connection. You can still play offline." retryLabel="Play Offline" onRetry={() => goTab('PlayTab')} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { gap: isTall ? 14 : 10, paddingBottom: 28 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {unfinished ? (
            <AppCard selected onPress={resume} testID="resume-game" accessibilityLabel="Resume your unfinished game">
              <Text style={[type.subheading, { color: c.text }]}>You have a game in progress</Text>
              <Text style={[type.small, { color: c.textSecondary, marginTop: 2 }]}>
                {unfinished.boardSize}x{unfinished.boardSize} · {unfinished.status === 'IN_PROGRESS' ? 'Tap to return to your match' : 'Waiting to start'}
              </Text>
            </AppCard>
          ) : null}

          {/* 1v1 Ranked Ladder Card */}
          <AppCard padding="md" style={styles.rankedCard}>
            <View style={styles.rankedHeader}>
              <View>
                <Text style={[styles.rankedTitle, { color: c.text }]}>1v1 Ranked Ladder</Text>
                <Text style={[styles.rankedSub, { color: c.textSecondary }]}>Matched by ELO • 30s turn clock</Text>
              </View>
              <View style={styles.onlineDot} />
            </View>

            <View style={{ marginTop: 6, gap: 8 }}>
              <BoardSizePicker value={size} onChange={setSize} />
              <AppButton
                testID="quick-match"
                title="Quick Ranked Match"
                fullWidth
                onPress={() => nav.navigate('matchmaking', { boardSize: size })}
              />
            </View>
          </AppCard>

          {/* 2-col Create & Join Room buttons */}
          <View style={styles.roomActions}>
            <Pressy
              testID="create-room"
              accessibilityLabel="Create Room"
              onPress={() => nav.navigate('create_room')}
              style={[styles.actionBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}
            >
              <PlusSquare size={16} color={c.accent} />
              <Text style={[styles.actionBtnText, { color: c.text }]}>Create Room</Text>
            </Pressy>

            <Pressy
              testID="join-room"
              accessibilityLabel="Join Room"
              onPress={() => nav.navigate('join_room')}
              style={[styles.actionBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}
            >
              <KeyRound size={16} color={c.accent} />
              <Text style={[styles.actionBtnText, { color: c.text }]}>Join Room</Text>
            </Pressy>
          </View>

          {/* Open Rooms List */}
          <View style={{ gap: 8 }}>
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>OPEN ROOMS</Text>
            <View style={[styles.roomsGroup, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              {MOCK_OPEN_ROOMS.map((r, i) => (
                <View
                  key={r.id}
                  style={[
                    styles.roomRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                  ]}
                >
                  <View>
                    <Text style={[styles.roomHost, { color: c.text }]}>{r.host} • {r.size}</Text>
                    <Text style={[styles.roomMeta, { color: c.textSecondary }]}>{r.elo} ELO • #{r.id}</Text>
                  </View>
                  <Pressy
                    onPress={() => nav.navigate('join_room', { code: r.id })}
                    style={styles.joinPill}
                  >
                    <Text style={styles.joinPillText}>Join</Text>
                  </Pressy>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  eloBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  eloBadgeText: {
    fontSize: 11,
    fontFamily: fonts.mono.semibold,
  },
  rankedCard: {
    gap: 8,
  },
  rankedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankedTitle: {
    fontSize: 14,
    fontFamily: fonts.body.semibold,
  },
  rankedSub: {
    fontSize: 11,
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#15803D',
  },
  roomActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 12.5,
    fontFamily: fonts.body.semibold,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  roomsGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  roomHost: {
    fontSize: 12.5,
    fontFamily: fonts.body.semibold,
  },
  roomMeta: {
    fontSize: 10.5,
    fontFamily: fonts.mono.medium,
    marginTop: 2,
  },
  joinPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EFF4FF',
  },
  joinPillText: {
    fontSize: 11.5,
    fontFamily: fonts.body.semibold,
    color: '#1D4ED8',
  },
});
