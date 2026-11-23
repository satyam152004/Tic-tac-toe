import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { ErrorState } from '../../components/feedback/StateViews';
import { ActionButton } from '../../components/game/ActionButton';
import { fonts, type } from '../../design-system/typography';
import { useMe } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import { gameApi } from '../../services/api/gameApi';
import { joinRoomByCode } from '../../services/onlineActions';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { joinErrorMessage } from './JoinRoomScreen';
import { OPEN_ROOMS_KEY, fetchOpenRooms, useSocketStatus, type OpenRoom } from './shared';

import { ch, fs, ms } from '../../design-system/responsive';
const gridName = (n: number) => `${n}×${n} ${n === 3 ? 'Classic' : n === 4 ? 'Large' : 'Extra large'}`;

export const OnlineLobbyScreen: React.FC<RootScreenProps<'online_lobby'>> = () => {
  const c = useTheme();
  const { nav, goTab, back } = useAppNav();
  const me = useMe().data;
  const authOffline = useAuthStore((s) => s.offline);
  const status = useSocketStatus();
  const [joining, setJoining] = useState<string | null>(null);
  const active = useQuery({ queryKey: ['games', 'active'], queryFn: gameApi.active, enabled: !authOffline, staleTime: 5000 });

  const offline = authOffline || status === 'closed';
  const open = useQuery({ queryKey: OPEN_ROOMS_KEY, queryFn: () => fetchOpenRooms(10), enabled: !offline, staleTime: 5000, refetchInterval: 15000 });
  const elo = me?.stats?.points ?? 0;
  const unfinished = (active.data ?? []).find((g) => g.status === 'IN_PROGRESS' || g.status === 'READY' || g.status === 'WAITING');

  const resume = () => {
    if (!unfinished) return;
    if (status === 'reconnecting') nav.navigate('reconnection', { gameId: unfinished.id });
    else nav.navigate('online_board', { gameId: unfinished.id });
  };

  const joinOpen = async (r: OpenRoom) => {
    if (joining) return;
    setJoining(r.id);
    try {
      const room = await joinRoomByCode(r.code);
      nav.replace('waiting_room', { roomId: room.id });
    } catch (e) {
      toast.error('Could not join', joinErrorMessage(e));
      void open.refetch();
    } finally {
      setJoining(null);
    }
  };

  return (
    <Screen
      title="Play Online"
      onBack={back}
      scroll={false}
      padded={false}
      testID="online-lobby"
      rightAction={
        <View style={[styles.eloBadge, { backgroundColor: c.bgElevated, borderColor: '#BFDBFE' }]}>
          <Text style={[styles.eloBadgeText, { color: c.accent }]} numberOfLines={1}>{elo.toLocaleString()} pts</Text>
        </View>
      }
    >
      {offline ? (
        <View style={{ padding: ms(20) }}>
          <ErrorState offline message="Online play needs an internet connection. You can still play offline." retryLabel="Play Offline" onRetry={() => goTab('PlayTab')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {unfinished ? (
            <AppCard selected onPress={resume} testID="resume-game" accessibilityLabel="Resume your unfinished game">
              <Text style={[type.subheading, { color: c.text }]}>You have a game in progress</Text>
              <Text style={[type.small, { color: c.textSecondary, marginTop: ms(2) }]}>
                {unfinished.boardSize}x{unfinished.boardSize} · {unfinished.status === 'IN_PROGRESS' ? 'Tap to return to your match' : 'Waiting to start'}
              </Text>
            </AppCard>
          ) : null}

          {/* 1v1 Ranked Ladder */}
          <View style={[styles.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <View style={styles.rankedHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rankedTitle, { color: c.text }]}>Ranked match</Text>
                <Text style={[styles.rankedSub, { color: c.textSecondary }]}>Matched by rating • 30s per turn</Text>
              </View>
              <View style={[styles.onlineDot, { backgroundColor: c.success }]} />
            </View>
            <ActionButton tall fullWidth testID="quick-match" title="Quick Ranked Match" onPress={() => nav.navigate('matchmaking', { boardSize: 3 })} />
          </View>

          <View style={styles.roomActions}>
            <ActionButton tall variant="secondary" testID="create-room" title="Create Room" onPress={() => nav.navigate('create_room')} style={styles.flex} />
            <ActionButton tall variant="secondary" testID="join-room" title="Join Room" onPress={() => nav.navigate('join_room')} style={styles.flex} />
          </View>

          {/* Open Rooms: real public rooms from GET /rooms/open */}
          <View>
            <Text style={[styles.sectionLabel, { color: '#8E939E' }]}>OPEN ROOMS</Text>
            <View testID="open-rooms" style={[styles.group, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              {open.isLoading ? (
                <View style={styles.row}>
                  <ActivityIndicator color={c.accent} />
                </View>
              ) : open.isError ? (
                <Pressy testID="open-rooms-retry" accessibilityLabel="Retry loading open rooms" onPress={() => void open.refetch()} style={styles.row}>
                  <Text style={[styles.rowSub, { color: c.textSecondary, flex: 1 }]}>{friendlyMessage(open.error)}</Text>
                  <Text style={[styles.joinText, { color: c.accent }]}>Retry</Text>
                </Pressy>
              ) : (open.data ?? []).length === 0 ? (
                <View style={styles.row}>
                  <Text testID="open-rooms-empty" style={[styles.rowSub, { color: c.textSecondary }]}>
                    No open rooms right now. Create one and share the code.
                  </Text>
                </View>
              ) : (
                (open.data ?? []).map((r, i) => (
                  <View key={r.id} testID={`open-room-${r.id}`} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[styles.rowTitle, { color: c.text }]}>
                        {r.host.displayName} • {gridName(r.boardSize)}
                      </Text>
                      <Text numberOfLines={1} style={[styles.rowSub, { color: c.textSecondary }]}>
                        {r.hostPoints.toLocaleString()} pts • #{r.code}
                      </Text>
                    </View>
                    <Pressy
                      testID={`open-room-join-${r.id}`}
                      accessibilityLabel={`Join ${r.host.displayName}'s room`}
                      disabled={!!joining}
                      onPress={() => void joinOpen(r)}
                      style={[styles.joinBtn, { backgroundColor: c.bgElevated, opacity: joining && joining !== r.id ? 0.5 : 1 }]}
                    >
                      {joining === r.id ? <ActivityIndicator size="small" color={c.accent} /> : <Text style={[styles.joinText, { color: c.accent }]}>Join</Text>}
                    </Pressy>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: ms(20), paddingTop: ms(8), paddingBottom: ms(24), gap: ms(14) },
  flex: { flex: 1 },
  eloBadge: { paddingHorizontal: ms(10), paddingVertical: ms(4), borderRadius: 999, borderWidth: 1 },
  eloBadgeText: { fontSize: fs(11), fontFamily: fonts.mono.semibold },
  card: { borderRadius: ms(14), borderWidth: 1, padding: ms(14), gap: ms(10) },
  rankedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankedTitle: { fontSize: fs(13.5), fontFamily: fonts.body.semibold },
  rankedSub: { fontSize: fs(11), fontFamily: fonts.body.regular },
  onlineDot: { width: ms(9.6), height: ms(9.6), borderRadius: 999 },
  roomActions: { flexDirection: 'row', gap: ms(10) },
  sectionLabel: { fontSize: fs(10), fontFamily: fonts.body.semibold, letterSpacing: 0.5, marginBottom: ms(5) },
  group: { borderRadius: ms(14), borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: ch(38), paddingVertical: ms(8), paddingHorizontal: ms(13), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ms(8) },
  rowTitle: { fontSize: fs(12), fontFamily: fonts.body.semibold },
  rowSub: { fontSize: fs(10), fontFamily: fonts.body.regular },
  joinBtn: { minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ms(10), paddingVertical: ms(4), borderRadius: ms(8) },
  joinText: { fontSize: fs(11), fontFamily: fonts.body.semibold },
});
