import { type } from '../../design-system/typography';
import type { ThemeColors } from '../../design-system/colors';
import { withAlpha } from '../../design-system/colors';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Copy, Share2 } from 'lucide-react-native';
import { ActionButton } from '../../components/game/ActionButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { fonts } from '../../design-system/typography';
import { useBackGuard } from '../../hooks/useBackGuard';
import { ConfirmDialog } from '../../components/common/AppModal';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import { leaveRoom } from '../../services/onlineActions';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { copyText, isOfflineError, RoomEnded, shareRoomCode, useRoom } from './shared';

import { ch, fs, ms } from '../../design-system/responsive';
export const WaitingRoomScreen: React.FC<RootScreenProps<'waiting_room'>> = ({ route }) => {
  const c = useTheme();
  const styles = makeStyles(c);
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
      nav.replace('match_found', { gameId: room.gameId, source: 'ROOM' });
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
    <>
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
      <View style={{ gap: ms(14) }}>
        {/* Room Code Card */}
        <View style={[styles.codeCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[styles.codeTag, { color: c.textSecondary }]}>ROOM CODE</Text>
          <Text testID="room-code" style={[styles.codeValue, { color: c.text }]}>{codeDisplay}</Text>
          <View style={styles.codeActions}>
            <Pressy
              testID="copy-code"
              accessibilityLabel="Copy room code"
              onPress={() => void copyText(room.code, 'Room code')}
              style={[styles.codeBtn, { backgroundColor: c.bgElevated }]}
            >
              <Copy size={ms(16)} color={c.accent} />
              <Text style={[styles.codeBtnText, { color: c.accent }]}>Copy</Text>
            </Pressy>
            <Pressy
              testID="share-code"
              accessibilityLabel="Share room code"
              onPress={() => void shareRoomCode(room)}
              style={[styles.codeBtn, { backgroundColor: c.bgSecondary }]}
            >
              <Share2 size={ms(16)} color={c.text} />
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
            <View style={[styles.badge, { backgroundColor: withAlpha(c.success, 0.14) }]}>
              <Text style={[styles.badgeText, { color: c.success }]}>Ready</Text>
            </View>
          </View>
          <View style={styles.slotRow}>
            <View style={styles.slotLeft}>
              <View style={styles.avatarEmpty}>
                <Text style={[styles.avatarEmptyText, { color: c.textSecondary }]}>?</Text>
              </View>
              <Text style={[styles.slotName, { color: c.textSecondary, fontFamily: fonts.body.regular }]}>Waiting for opponent...</Text>
            </View>
            <View style={[styles.pulsingDot, { backgroundColor: c.accent }]} />
          </View>
        </View>
      </View>
    </Screen>
    <ConfirmDialog {...guard.dialog} />
    </>
  );
};

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  codeCard: { borderRadius: ms(14), borderWidth: 1, padding: ms(14), alignItems: 'center', gap: ms(10) },
  codeTag: { ...type.overline, letterSpacing: 0.5 },
  codeValue: { ...type.code, letterSpacing: 2.6 },
  codeActions: { flexDirection: 'row', gap: ms(8), alignSelf: 'stretch' },
  codeBtn: { flex: 1, height: ch(32), borderRadius: ms(8), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: ms(4) },
  codeBtnText: { ...type.overline, },
  slotsGroup: { borderRadius: ms(14), borderWidth: 1, overflow: 'hidden' },
  slotRow: { minHeight: ch(38), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: ms(13), paddingVertical: ms(8), gap: ms(8) },
  slotLeft: { flexDirection: 'row', alignItems: 'center', gap: ms(8), flex: 1 },
  avatar: { width: ms(28.8), height: ms(28.8), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...type.overline, color: c.bgCard },
  avatarEmpty: { width: ms(28.8), height: ms(28.8), borderRadius: 999, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  avatarEmptyText: { ...type.overline, },
  slotName: { ...type.labelStrong, },
  badge: { paddingHorizontal: ms(8), paddingVertical: ms(2), borderRadius: ms(6) },
  badgeText: { ...type.overline, },
  pulsingDot: { width: ms(9.6), height: ms(9.6), borderRadius: 999 },
});
