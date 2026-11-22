import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
import { useBackGuard } from '../../hooks/useBackGuard';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import { leaveRoom } from '../../services/onlineActions';
import { useAuthStore } from '../../store/authStore';
import { isOfflineError, RoomEnded, useRoom } from './shared';

export const RoomDetailsScreen: React.FC<RootScreenProps<'room_details'>> = ({ route }) => {
  const c = useTheme();
  const { roomId } = route.params;
  const { nav, goHome } = useAppNav();
  const meId = useAuthStore((s) => s.user?.id);
  const { room, ended, loading, error, retry } = useRoom(roomId);
  const moved = useRef(false);

  const live = !!room && !ended && !room.gameId;
  const guard = useBackGuard({
    when: live,
    title: 'Close this room?',
    message: 'Leaving closes the room and your invitation code stops working.',
    confirmLabel: 'Leave room',
    onLeave: () => void leaveRoom(roomId).catch(() => undefined),
  });

  useEffect(() => {
    if (!room || moved.current) return;
    if (room.gameId) {
      moved.current = true;
      guard.allow();
      nav.replace('online_board', { gameId: room.gameId });
    } else if (meId && room.hostId !== meId) {
      moved.current = true;
      guard.allow();
      nav.replace('waiting_room', { roomId });
    }
  }, [room, meId, guard, nav, roomId]);

  const toLobby = () => {
    guard.allow();
    nav.replace('online_lobby');
  };

  if (ended) return <Screen title="Room Details" onBack={toLobby}><RoomEnded reason={ended} onLeave={toLobby} /></Screen>;
  if (error && !room) return <Screen title="Room Details" onBack={toLobby}><ErrorState offline={isOfflineError(error)} message={friendlyMessage(error)} onRetry={retry} /></Screen>;
  if (loading || !room) return <Screen title="Room Details" onBack={toLobby}><AppLoader label="Loading room..." /></Screen>;

  const hostName = room.host?.displayName ?? 'Host';
  const guestName = room.guest?.displayName ?? 'Waiting for Opponent';
  const codeDisplay = room.code.length >= 3 ? `${room.code.slice(0, 3)}-${room.code.slice(3)}` : room.code;

  return (
    <Screen
      title="Room Details"
      onBack={() => (live ? nav.goBack() : goHome())}
      footer={
        <AppButton
          testID="open-waiting-room"
          title="Ready to Start"
          fullWidth
          onPress={() => {
            guard.allow();
            nav.replace('waiting_room', { roomId });
          }}
        />
      }
    >
      <View style={{ gap: 14 }}>
        {/* Player Slots Group */}
        <View style={[styles.group, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                <Text style={styles.avatarText}>{hostName.slice(0, 2).toUpperCase()}</Text>
              </View>
              <Text style={[styles.playerName, { color: c.text }]}>{hostName} (Host)</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#F0FDF4' }]}>
              <Text style={[styles.badgeText, { color: '#15803D' }]}>Ready</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.avatar, { backgroundColor: '#141518' }]}>
                <Text style={styles.avatarText}>{guestName.slice(0, 2).toUpperCase()}</Text>
              </View>
              <Text style={[styles.playerName, { color: room.guest ? c.text : c.textSecondary }]}>
                {guestName} {room.guest ? '(Opponent)' : ''}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: room.guestReady ? '#F0FDF4' : '#EFF4FF' }]}>
              <Text style={[styles.badgeText, { color: room.guestReady ? '#15803D' : c.accent }]}>
                {room.guestReady ? 'Ready' : room.guest ? 'Connecting' : 'Waiting'}
              </Text>
            </View>
          </View>
        </View>

        {/* Rules Summary Card */}
        <AppCard padding="md" style={styles.rulesCard}>
          <Text style={[styles.rulesTag, { color: c.textSecondary }]}>RULES SUMMARY</Text>
          <Text style={[styles.rulesMain, { color: c.text }]}>
            {room.boardSize}×{room.boardSize} • 30s/turn • Ranked
          </Text>
          <Text style={[styles.rulesSub, { color: c.textSecondary }]}>
            Room {codeDisplay} • +18 / -14 ELO stakes
          </Text>
        </AppCard>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  group: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontFamily: fonts.mono.semibold,
    color: '#FFFFFF',
  },
  playerName: {
    fontSize: 12.5,
    fontFamily: fonts.body.semibold,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10.5,
    fontFamily: fonts.body.semibold,
  },
  rulesCard: {
    gap: 6,
    padding: 14,
  },
  rulesTag: {
    fontSize: 10,
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  rulesMain: {
    fontSize: 13.5,
    fontFamily: fonts.body.semibold,
  },
  rulesSub: {
    fontSize: 11,
    fontFamily: fonts.mono.medium,
  },
});
