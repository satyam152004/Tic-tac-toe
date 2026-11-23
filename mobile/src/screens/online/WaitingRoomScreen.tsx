import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Copy, Share2 } from 'lucide-react-native';
import { ActionButton } from '../../components/game/ActionButton';
import { Pressy } from '../../components/common/Pressy';
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
import { toast } from '../../store/toastStore';
import { copyText, isOfflineError, RoomEnded, shareRoomCode, useRoom } from './shared';

export const WaitingRoomScreen: React.FC<RootScreenProps<'waiting_room'>> = ({ route }) => {
  const c = useTheme();
  const { roomId } = route.params;
  const { nav, goHome } = useAppNav();
  const meId = useAuthStore((s) => s.user?.id);
  const { room, ended, loading, error, retry } = useRoom(roomId);
  const moved = useRef(false);

  const isHost = !!room && room.hostId === meId;
  const live = !!room && !ended && !room.gameId;
  const guard = useBackGuard({
    when: live,
    title: 'Leave room?',
    message: isHost ? 'Leaving closes the room.' : 'You will leave this room.',
    confirmLabel: 'Leave room',
    onLeave: () => void leaveRoom(roomId).catch(() => undefined),
  });

  useEffect(() => {
    if (moved.current || !room) return;
    if (room.gameId) {
      moved.current = true;
      guard.allow();
      nav.replace('online_board', { gameId: room.gameId });
    } else if (room.guest) {
      // Both seats are taken: the Room Details screen shows readiness and starts the match.
      moved.current = true;
      guard.allow();
      nav.replace('room_details', { roomId });
    }
  }, [room?.gameId, room?.guest, guard, nav, roomId]);

  const toLobby = () => {
    guard.allow();
    goHome();
  };

  const leave = async () => {
    moved.current = true;
    guard.allow();
    try {
      await leaveRoom(roomId);
    } catch (e) {
      toast.error('Could not leave room', friendlyMessage(e));
    }
    nav.replace('online_lobby');
  };

  if (ended) return <Screen title="Waiting Room" onBack={toLobby}><RoomEnded reason={ended} onLeave={toLobby} /></Screen>;
  if (error && !room) return <Screen title="Waiting Room" onBack={toLobby}><ErrorState offline={isOfflineError(error)} message={friendlyMessage(error)} onRetry={retry} /></Screen>;
  if (loading || !room) return <Screen title="Waiting Room" onBack={toLobby}><AppLoader label="Loading room..." /></Screen>;

  const codeDisplay = room.code.length >= 3 ? `${room.code.slice(0, 3)}-${room.code.slice(3)}` : room.code;

  return (
    <Screen
      title="Waiting Room"
      onBack={leave}
      footer={
        <ActionButton
          testID="leave-room"
          title={isHost ? 'Cancel Room' : 'Leave Room'}
          variant={isHost ? 'danger' : 'secondary'}
          fullWidth
          onPress={leave}
        />
      }
    >
      <View style={{ gap: 14 }}>
        {/* Room Code Card */}
        <View style={[styles.codeCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[styles.codeTag, { color: '#8E939E' }]}>ROOM CODE</Text>
          <Text testID="room-code" style={[styles.codeValue, { color: c.text }]}>{codeDisplay}</Text>
          <View style={styles.codeActions}>
            <Pressy
              testID="copy-code"
              accessibilityLabel="Copy room code"
              onPress={() => void copyText(room.code, 'Room code')}
              style={[styles.codeBtn, { backgroundColor: c.bgElevated }]}
            >
              <Copy size={13} color={c.accent} />
              <Text style={[styles.codeBtnText, { color: c.accent }]}>Copy</Text>
            </Pressy>
            <Pressy
              testID="share-code"
              accessibilityLabel="Share room code"
              onPress={() => void shareRoomCode(room)}
              style={[styles.codeBtn, { backgroundColor: c.bgSecondary }]}
            >
              <Share2 size={13} color={c.text} />
              <Text style={[styles.codeBtnText, { color: c.text }]}>Share</Text>
            </Pressy>
          </View>
        </View>

        {/* Host vs waiting slot */}
        <View style={[styles.slotsGroup, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={[styles.slotRow, { borderBottomWidth: 1, borderBottomColor: c.border }]}>
            <View style={styles.slotLeft}>
              <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                <Text style={styles.avatarText}>{(room.host?.displayName ?? 'H').slice(0, 2).toUpperCase()}</Text>
              </View>
              <Text style={[styles.slotName, { color: c.text }]}>{room.host?.displayName ?? 'Host'} (Host)</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#F0FDF4' }]}>
              <Text style={[styles.badgeText, { color: '#15803D' }]}>Ready</Text>
            </View>
          </View>
          <View style={styles.slotRow}>
            <View style={styles.slotLeft}>
              <View style={styles.avatarEmpty}>
                <Text style={[styles.avatarEmptyText, { color: '#8E939E' }]}>?</Text>
              </View>
              <Text style={[styles.slotName, { color: '#8E939E', fontFamily: fonts.body.regular }]}>Waiting for opponent...</Text>
            </View>
            <View style={[styles.pulsingDot, { backgroundColor: c.accent }]} />
          </View>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  codeCard: { borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 10 },
  codeTag: { fontSize: 10, fontFamily: fonts.body.semibold, letterSpacing: 0.5 },
  codeValue: { fontSize: 22, fontFamily: fonts.mono.semibold, letterSpacing: 2.6 },
  codeActions: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  codeBtn: { flex: 1, height: 32, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  codeBtnText: { fontSize: 11.5, fontFamily: fonts.body.semibold },
  slotsGroup: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  slotRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, paddingVertical: 8, gap: 8 },
  slotLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 10, fontFamily: fonts.body.semibold, color: '#FFFFFF' },
  avatarEmpty: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#CFCFC8', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  avatarEmptyText: { fontSize: 10, fontFamily: fonts.body.regular },
  slotName: { fontSize: 12.5, fontFamily: fonts.body.semibold },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontFamily: fonts.body.semibold },
  pulsingDot: { width: 8, height: 8, borderRadius: 4 },
});
