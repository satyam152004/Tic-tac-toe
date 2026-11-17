import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { gameApi } from '../../services/api/gameApi';
import { userApi } from '../../services/api/userApi';
import { joinGame, joinRoomByCode } from '../../services/onlineActions';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { isOfflineError } from './shared';
import { joinErrorMessage } from './JoinRoomScreen';

/** A friend challenge (game id) or room invitation (room code), from a notification or a deep link. */
export const MatchInvitationScreen: React.FC<RootScreenProps<'match_invitation'>> = ({ route }) => {
  const c = useTheme();
  const { nav, goHome, back } = useAppNav();
  const { gameId, roomCode, fromName } = route.params ?? {};
  const myId = useAuthStore((s) => s.user?.id);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const game = useQuery({ queryKey: ['game', gameId], queryFn: () => gameApi.get(gameId!), enabled: !!gameId, retry: false });
  const inviterId = game.data?.players.find((p) => p.userId && p.userId !== myId)?.userId ?? null;
  const inviter = useQuery({ queryKey: ['profile', inviterId], queryFn: () => userApi.get(inviterId!), enabled: !!inviterId });

  const close = () => (nav.canGoBack() ? back() : goHome());

  if (!gameId && !roomCode) {
    return (
      <Screen title="Match Invitation" onBack={close}>
        <ErrorState title="Invalid invitation" message="This invitation link is not valid." retryLabel="Back" onRetry={close} />
      </Screen>
    );
  }

  if (gameId && game.isLoading) {
    return (
      <Screen title="Match Invitation" onBack={close}>
        <AppLoader label="Loading invitation..." />
      </Screen>
    );
  }

  if (gameId && game.isError) {
    const code = toApiError(game.error).code;
    return (
      <Screen title="Match Invitation" onBack={close}>
        <ErrorState
          offline={isOfflineError(game.error)}
          title={code === 'GAME_NOT_FOUND' || code === 'NOT_A_PLAYER' ? 'Invitation unavailable' : undefined}
          message={friendlyMessage(game.error)}
          onRetry={isOfflineError(game.error) ? () => void game.refetch() : close}
          retryLabel={isOfflineError(game.error) ? 'Try Again' : 'Back'}
        />
      </Screen>
    );
  }

  const g = game.data;
  const expired = !!g && g.status !== 'WAITING' && g.status !== 'READY';
  if (expired) {
    return (
      <Screen title="Match Invitation" onBack={close}>
        <ErrorState
          title="Invitation expired"
          message={g.status === 'IN_PROGRESS' ? 'This match has already started.' : 'This challenge is no longer available.'}
          retryLabel="Back"
          onRetry={close}
        />
      </Screen>
    );
  }

  const name = inviter.data?.displayName ?? fromName ?? 'A friend';

  const accept = async () => {
    if (busy) return;
    setBusy('accept');
    setFailure(null);
    try {
      if (gameId) {
        await joinGame(gameId);
        nav.replace('online_board', { gameId });
      } else if (roomCode) {
        const room = await joinRoomByCode(roomCode);
        nav.replace('waiting_room', { roomId: room.id });
      }
    } catch (e) {
      setFailure(roomCode && !gameId ? joinErrorMessage(e) : friendlyMessage(e));
      setBusy(null);
    }
  };

  const decline = async () => {
    if (busy) return;
    setBusy('decline');
    try {
      // Forfeiting a game that has not started cancels it on the server.
      if (gameId) await gameApi.forfeit(gameId);
      toast.info('Invitation declined');
      close();
    } catch (e) {
      toast.error('Could not decline', friendlyMessage(e));
      setBusy(null);
    }
  };

  return (
    <Screen title="Match Invitation" onBack={close}>
      <View style={styles.center}>
        <AppCard padding="lg" style={{ gap: 18, alignItems: 'center' }}>
          <Text style={[type.smallStrong, { color: c.accent }]}>{gameId ? 'Incoming Match Invitation' : 'Incoming Room Invitation'}</Text>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <AppAvatar avatarId={inviter.data?.avatar} name={name} size="xl" status={inviter.data?.online ? 'online' : undefined} activeRing />
            <Text testID="inviter-name" style={[type.headline, { color: c.text }]}>{name}</Text>
            {inviter.data ? (
              <Text style={[type.small, { color: c.textSecondary }]}>
                Level {inviter.data.stats.level} · {inviter.data.stats.points} pts · {Math.round(inviter.data.stats.winPercentage)}% win rate
              </Text>
            ) : null}
          </View>

          <AppCard padding="sm" style={{ alignSelf: 'stretch' }}>
            <Text style={[type.bodyStrong, { color: c.text }]}>{gameId ? 'Friendly Duel' : 'Private Room'}</Text>
            {g ? (
              <Text style={[type.small, { color: c.textSecondary }]}>
                {g.boardSize}x{g.boardSize} Board · {g.winLength} in a row · {g.turnTimeoutSec}s turn clock
              </Text>
            ) : (
              <Text style={[type.small, { color: c.textSecondary }]}>Room code {roomCode}</Text>
            )}
          </AppCard>

          {failure ? (
            <Text testID="invitation-error" accessibilityRole="alert" style={[type.small, { color: '#F87171', textAlign: 'center' }]}>{failure}</Text>
          ) : null}

          <View style={styles.row}>
            <AppButton testID="decline-invite" title="Decline" variant="outline" style={{ flex: 1 }} loading={busy === 'decline'} disabled={busy === 'accept'} onPress={decline} />
            <AppButton testID="accept-invite" title="Accept" style={{ flex: 1 }} loading={busy === 'accept'} disabled={busy === 'decline'} onPress={accept} />
          </View>
        </AppCard>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingVertical: 24 },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
});
