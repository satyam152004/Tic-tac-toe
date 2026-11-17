import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { Share2, Users } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ConfirmDialog } from '../../components/common/AppModal';
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
import { leaveRoom, setReady, startRoomGame } from '../../services/onlineActions';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { CodeText, copyText, InviteFriendsModal, isOfflineError, PlayerSlot, RoomEnded, shareRoomCode, useRoom } from './shared';

export const WaitingRoomScreen: React.FC<RootScreenProps<'waiting_room'>> = ({ route }) => {
  const c = useTheme();
  const { roomId } = route.params;
  const { nav, goHome } = useAppNav();
  const meId = useAuthStore((s) => s.user?.id);
  const { room, ended, loading, error, retry } = useRoom(roomId);
  const [busy, setBusy] = useState<'ready' | 'start' | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const left = useCountdown(room ? Date.parse(room.expiresAt) : null);
  const moved = useRef(false);

  const isHost = !!room && room.hostId === meId;
  const live = !!room && !ended && !room.gameId;
  const guard = useBackGuard({
    when: live,
    title: 'Leave room?',
    message: isHost ? 'Leaving closes the room (or hands it to your guest).' : 'You will leave this room.',
    confirmLabel: 'Leave room',
    onLeave: () => void leaveRoom(roomId).catch(() => undefined),
  });

  // The server announces the started game on `room.gameId` (room:updated) on both devices.
  useEffect(() => {
    if (room?.gameId && !moved.current) {
      moved.current = true;
      guard.allow();
      nav.replace('online_board', { gameId: room.gameId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.gameId]);

  const toLobby = () => {
    guard.allow();
    goHome();
  };

  const leave = async () => {
    setConfirmLeave(false);
    guard.allow();
    try {
      await leaveRoom(roomId);
    } catch (e) {
      toast.error('Could not leave the room', friendlyMessage(e));
    }
    nav.replace('online_lobby');
  };

  const toggleReady = async () => {
    if (!room || busy) return;
    setBusy('ready');
    try {
      await setReady(room.id, !room.guestReady);
    } catch (e) {
      toast.error('Could not update', friendlyMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const start = async () => {
    if (!room || busy) return;
    setBusy('start');
    try {
      const game = await startRoomGame(room.id);
      moved.current = true;
      guard.allow();
      nav.replace('online_board', { gameId: game.id });
    } catch (e) {
      toast.error('Could not start the match', friendlyMessage(e));
      setBusy(null);
    }
  };

  let body: React.ReactNode;
  let footer: React.ReactNode;
  if (ended) body = <RoomEnded reason={ended} onLeave={toLobby} />;
  else if (error && !room) body = <ErrorState offline={isOfflineError(error)} message={friendlyMessage(error)} onRetry={retry} />;
  else if (loading || !room) body = <AppLoader label="Loading room..." />;
  else {
    const guestPresent = !!room.guest;
    body = (
      <>
        <AppCard>
          <Text style={[type.small, { color: c.textSecondary, textAlign: 'center', marginBottom: 6 }]}>Room Code</Text>
          <CodeText code={room.code} />
          <Text style={[type.small, { color: c.textSecondary, textAlign: 'center', marginTop: 8 }]}>
            {room.boardSize}x{room.boardSize} Grid · {room.winLength} in a row
          </Text>
          {left !== null ? (
            <Text testID="room-expiry" style={[type.caption, { color: left < 60 ? c.warning : c.textSecondary, textAlign: 'center', marginTop: 4 }]}>
              Expires in {formatClock(left)}
            </Text>
          ) : null}
        </AppCard>

        <PlayerSlot card={room.host} role="Host" mark="X" ready status="Host ready" highlight={isHost} />
        <PlayerSlot card={room.guest} role="Guest" mark="O" ready={room.guestReady} highlight={!isHost} />

        {!guestPresent && isHost ? (
          <>
            <AppButton testID="share-code" title="Share Code" variant="secondary" fullWidth icon={<Share2 size={16} color={c.text} />} onPress={() => void shareRoomCode(room)} />
            <AppButton testID="copy-code" title="Copy Code" variant="outline" fullWidth onPress={() => void copyText(room.code, 'Room code')} />
            <AppButton testID="invite-friends" title="Invite a Friend" variant="outline" fullWidth icon={<Users size={16} color={c.accent} />} onPress={() => setInviteOpen(true)} />
            <InviteFriendsModal open={inviteOpen} roomId={room.id} onClose={() => setInviteOpen(false)} />
          </>
        ) : null}
        {guestPresent && isHost && !room.guestReady ? (
          <Text style={[type.small, { color: c.textSecondary, textAlign: 'center' }]}>Waiting for {room.guest?.displayName} to get ready...</Text>
        ) : null}
        {!isHost ? (
          <Text style={[type.small, { color: c.textSecondary, textAlign: 'center' }]}>
            {room.guestReady ? 'Waiting for the host to start the match...' : 'Tap Ready when you are set to play.'}
          </Text>
        ) : null}
      </>
    );
    footer = (
      <>
        {isHost ? (
          <AppButton testID="start-match" title="Start Match" fullWidth loading={busy === 'start'} disabled={!guestPresent || !room.guestReady} onPress={start} />
        ) : (
          <AppButton testID="ready-toggle" title={room.guestReady ? 'Not Ready' : 'Ready'} variant={room.guestReady ? 'secondary' : 'primary'} fullWidth loading={busy === 'ready'} onPress={toggleReady} />
        )}
        <AppButton testID="leave-room" title={isHost ? 'Cancel Room' : 'Leave Room'} variant="outline" fullWidth onPress={() => setConfirmLeave(true)} />
      </>
    );
  }

  return (
    <Screen title="Waiting Room" subtitle={room ? `Room ${room.code}` : undefined} onBack={() => (live ? nav.goBack() : goHome())} footer={footer}>
      {body}
      <ConfirmDialog
        open={confirmLeave}
        title={isHost ? 'Cancel room?' : 'Leave room?'}
        message={isHost ? 'Your guest will be disconnected from this room.' : 'You will leave this room.'}
        confirmLabel={isHost ? 'Cancel Room' : 'Leave'}
        cancelLabel="Stay"
        destructive
        onConfirm={leave}
        onCancel={() => setConfirmLeave(false)}
      />
    </Screen>
  );
};
