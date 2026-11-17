import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { Copy, Share2, Users } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { type } from '../../design-system/typography';
import { formatClock, useCountdown } from '../../hooks/useOnlineGame';
import { useBackGuard } from '../../hooks/useBackGuard';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import { leaveRoom } from '../../services/onlineActions';
import { useAuthStore } from '../../store/authStore';
import { CodeText, copyText, InviteFriendsModal, isOfflineError, PlayerSlot, RoomEnded, shareRoomCode, useRoom } from './shared';

/** Host's view of a freshly created room: code, config, seats, invitations. Continues in `waiting_room`. */
export const RoomDetailsScreen: React.FC<RootScreenProps<'room_details'>> = ({ route }) => {
  const c = useTheme();
  const { roomId } = route.params;
  const { nav, goHome } = useAppNav();
  const meId = useAuthStore((s) => s.user?.id);
  const { room, ended, loading, error, retry } = useRoom(roomId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const left = useCountdown(room ? Date.parse(room.expiresAt) : null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, meId]);

  const toLobby = () => {
    guard.allow();
    nav.replace('online_lobby');
  };

  let body: React.ReactNode;
  if (ended) body = <RoomEnded reason={ended} onLeave={toLobby} />;
  else if (error && !room) body = <ErrorState offline={isOfflineError(error)} message={friendlyMessage(error)} onRetry={retry} />;
  else if (loading || !room) body = <AppLoader label="Loading room..." />;
  else {
    body = (
      <>
        <AppCard>
          <Text style={[type.small, { color: c.textSecondary, textAlign: 'center', marginBottom: 6 }]}>Private Room Code</Text>
          <CodeText code={room.code} />
          <Text style={[type.small, { color: c.textSecondary, textAlign: 'center', marginTop: 8 }]}>
            {room.boardSize}x{room.boardSize} Board · {room.winLength} in a row
          </Text>
          {left !== null ? (
            <Text testID="room-expiry" style={[type.caption, { color: left < 60 ? c.warning : c.textSecondary, textAlign: 'center', marginTop: 4 }]}>
              Expires in {formatClock(left)}
            </Text>
          ) : null}
          <AppButton testID="copy-code" title="Copy Code" variant="secondary" size="md" icon={<Copy size={16} color={c.text} />} onPress={() => void copyText(room.code, 'Room code')} style={{ marginTop: 12 }} />
        </AppCard>

        <Text style={[type.smallStrong, { color: c.textSecondary }]}>Player Slots</Text>
        <PlayerSlot card={room.host} role="Host" mark="X" ready status="Ready" highlight />
        <PlayerSlot card={room.guest} role="Guest" mark="O" ready={room.guestReady} />

        <AppButton testID="share-code" title="Share Invitation" variant="secondary" fullWidth icon={<Share2 size={16} color={c.text} />} onPress={() => void shareRoomCode(room)} />
        <AppButton testID="invite-friends" title="Invite Friends" variant="outline" fullWidth icon={<Users size={16} color={c.accent} />} onPress={() => setInviteOpen(true)} />
        <InviteFriendsModal open={inviteOpen} roomId={room.id} onClose={() => setInviteOpen(false)} />
      </>
    );
  }

  return (
    <Screen
      title="Room Details"
      onBack={() => (live ? nav.goBack() : goHome())}
      footer={
        room && !ended ? (
          <AppButton
            testID="open-waiting-room"
            title="Open Waiting Room"
            fullWidth
            onPress={() => {
              guard.allow();
              nav.replace('waiting_room', { roomId });
            }}
          />
        ) : undefined
      }
    >
      {body}
    </Screen>
  );
};
