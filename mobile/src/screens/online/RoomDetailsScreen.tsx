import { type } from '../../design-system/typography';
import type { ThemeColors } from '../../design-system/colors';
import { withAlpha } from '../../design-system/colors';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { ActionButton } from '../../components/game/ActionButton';
import { fonts } from '../../design-system/typography';
import { useBackGuard } from '../../hooks/useBackGuard';
import { ConfirmDialog } from '../../components/common/AppModal';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import { leaveRoom, setReady, startRoomGame } from '../../services/onlineActions';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { isOfflineError, RoomEnded, timerLabel, useRoom } from './shared';

import { ch, fs, ms } from '../../design-system/responsive';
export const RoomDetailsScreen: React.FC<RootScreenProps<'room_details'>> = ({ route }) => {
  const c = useTheme();
  const styles = makeStyles(c);
  const { roomId } = route.params;
  const { nav, goHome } = useAppNav();
  const meId = useAuthStore((s) => s.user?.id);
  const { room, ended, loading, error, retry } = useRoom(roomId);
  const [busy, setBusy] = useState(false);
  const moved = useRef(false);

  const isHost = !!room && room.hostId === meId;
  const live = !!room && !ended && !room.gameId;
  const guard = useBackGuard({
    when: live,
    title: isHost ? 'Close this room?' : 'Leave room?',
    message: isHost ? 'The room will close and the code will stop working.' : 'You will leave this room.',
    confirmLabel: 'Leave room',
    onLeave: () => void leaveRoom(roomId).catch(() => undefined),
  });

  useEffect(() => {
    if (!room || moved.current) return;
    if (room.gameId) {
      moved.current = true;
      guard.allow();
      nav.replace('match_found', { gameId: room.gameId, source: 'ROOM' });
    } else if (!room.guest && isHost) {
      // The opponent left: back to waiting for a new one.
      moved.current = true;
      guard.allow();
      nav.replace('waiting_room', { roomId });
    }
  }, [room, isHost, guard, nav, roomId]);

  const toLobby = () => {
    guard.allow();
    nav.replace('online_lobby');
  };

  const act = async () => {
    if (!room || busy) return;
    setBusy(true);
    try {
      if (isHost) {
        const game = await startRoomGame(room.id);
        moved.current = true;
        guard.allow();
        nav.replace('match_found', { gameId: game.id, source: 'ROOM' });
        return;
      }
      await setReady(room.id, !room.guestReady);
    } catch (e) {
      toast.error(isHost ? 'Could not start match' : 'Could not update', friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (ended) return <Screen title="Room Details" onBack={toLobby}><RoomEnded reason={ended} onLeave={toLobby} /></Screen>;
  if (error && !room) return <Screen title="Room Details" onBack={toLobby}><ErrorState offline={isOfflineError(error)} message={friendlyMessage(error)} onRetry={retry} /></Screen>;
  if (loading || !room) return <Screen title="Room Details" onBack={toLobby}><AppLoader label="Loading room..." /></Screen>;

  const ext = room as typeof room & { isPublic?: boolean; turnTimeoutSec?: number };
  const hostName = room.host?.displayName ?? 'Host';
  const guestName = room.guest?.displayName ?? '';
  const codeDisplay = room.code.length >= 3 ? `${room.code.slice(0, 3)}-${room.code.slice(3)}` : room.code;

  return (
    <>
    <Screen
      title="Room Details"
      onBack={() => (live ? nav.goBack() : goHome())}
      footer={
        isHost ? (
          <ActionButton testID="start-match" title="Ready to Start" fullWidth loading={busy} disabled={!room.guest || !room.guestReady} onPress={act} />
        ) : (
          <ActionButton
            testID="ready-toggle"
            title={room.guestReady ? 'Not Ready' : 'Ready to Start'}
            variant={room.guestReady ? 'secondary' : 'primary'}
            fullWidth
            loading={busy}
            onPress={act}
          />
        )
      }
    >
      <View style={{ gap: ms(14) }}>
        <View style={[styles.group, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: c.border }]}>
            <View style={styles.left}>
              <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                <Text style={styles.avatarText}>{hostName.slice(0, 2).toUpperCase()}</Text>
              </View>
              <Text numberOfLines={1} style={[styles.playerName, { color: c.text }]}>{hostName} (Host)</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: withAlpha(c.success, 0.14) }]}>
              <Text style={[styles.badgeText, { color: c.success }]}>Ready</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.left}>
              <View style={[styles.avatar, { backgroundColor: c.text }]}>
                <Text style={styles.avatarText}>{(guestName || '?').slice(0, 2).toUpperCase()}</Text>
              </View>
              <Text numberOfLines={1} style={[styles.playerName, { color: room.guest ? c.text : c.textSecondary }]}>
                {room.guest ? `${guestName} (Opponent)` : 'Waiting for opponent...'}
              </Text>
            </View>
            <View testID="guest-status" style={[styles.badge, { backgroundColor: room.guestReady ? withAlpha(c.success, 0.14) : withAlpha(c.accent, 0.12) }]}>
              <Text style={[styles.badgeText, { color: room.guestReady ? c.success : c.accent }]}>
                {room.guestReady ? 'Ready' : room.guest ? 'Not ready' : 'Waiting'}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.rules, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[styles.rulesTag, { color: c.textSecondary }]}>RULES</Text>
          <Text style={[styles.rulesMain, { color: c.text }]}>
            {room.boardSize}×{room.boardSize} • {timerLabel(ext.turnTimeoutSec ?? 60)}/turn • {ext.isPublic ? 'Public' : 'Private'}
          </Text>
          <Text style={[styles.rulesSub, { color: c.textSecondary }]}>
            Room {codeDisplay} • {room.winLength} in a row to win
          </Text>
        </View>
      </View>
    </Screen>
    <ConfirmDialog {...guard.dialog} />
    </>
  );
};

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  group: { borderRadius: ms(14), borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: ch(38), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: ms(13), paddingVertical: ms(8), gap: ms(8) },
  left: { flexDirection: 'row', alignItems: 'center', gap: ms(8), flex: 1 },
  avatar: { width: ms(28.8), height: ms(28.8), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...type.overline, color: c.bgCard },
  playerName: { ...type.labelStrong, flexShrink: 1 },
  badge: { paddingHorizontal: ms(8), paddingVertical: ms(2), borderRadius: 999 },
  badgeText: { ...type.overline, },
  rules: { borderRadius: ms(14), borderWidth: 1, padding: ms(14), gap: ms(8) },
  rulesTag: { ...type.overline, letterSpacing: 0.5 },
  rulesMain: { ...type.labelStrong, },
  rulesSub: { ...type.overline, },
});
