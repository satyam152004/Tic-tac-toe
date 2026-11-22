import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
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
      <Screen title="Match Challenge" onBack={close}>
        <ErrorState title="Invalid invitation" message="This invitation link is not valid." retryLabel="Back" onRetry={close} />
      </Screen>
    );
  }

  if (gameId && game.isLoading) {
    return (
      <Screen title="Match Challenge" onBack={close}>
        <AppLoader label="Loading challenge..." />
      </Screen>
    );
  }

  if (gameId && game.isError) {
    const code = toApiError(game.error).code;
    return (
      <Screen title="Match Challenge" onBack={close}>
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
      <Screen title="Match Challenge" onBack={close}>
        <ErrorState
          title="Invitation expired"
          message={g.status === 'IN_PROGRESS' ? 'This match has already started.' : 'This challenge is no longer available.'}
          retryLabel="Back"
          onRetry={close}
        />
      </Screen>
    );
  }

  const name = inviter.data?.displayName ?? fromName ?? 'Aarav Patel';
  const elo = inviter.data?.stats?.points ?? 1540;

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
      if (gameId) await gameApi.forfeit(gameId);
      toast.info('Invitation declined');
      close();
    } catch (e) {
      toast.error('Could not decline', friendlyMessage(e));
      setBusy(null);
    }
  };

  return (
    <Screen
      title="Match Challenge"
      onBack={close}
      footer={
        <View style={{ gap: 8 }}>
          <AppButton
            testID="accept-invite"
            title="Accept Challenge"
            fullWidth
            loading={busy === 'accept'}
            disabled={busy === 'decline'}
            onPress={accept}
          />
          <AppButton
            testID="decline-invite"
            title="Decline"
            variant="secondary"
            fullWidth
            loading={busy === 'decline'}
            disabled={busy === 'accept'}
            onPress={decline}
          />
        </View>
      }
    >
      <View style={{ gap: 14 }}>
        <AppCard padding="lg" style={styles.card}>
          <AppAvatar avatarId={inviter.data?.avatar} name={name} size="xl" status="online" activeRing />
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text testID="inviter-name" style={[styles.name, { color: c.text }]}>
              {name}
            </Text>
            <Text style={[styles.sub, { color: c.textSecondary }]}>
              {elo.toLocaleString()} ELO • Friends
            </Text>
          </View>

          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: c.bgSecondary }]}>
              <Text style={[styles.pillText, { color: c.text }]}>
                {g ? `${g.boardSize}×${g.boardSize}` : '3×3'}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: c.bgSecondary }]}>
              <Text style={[styles.pillText, { color: c.text }]}>
                {g ? `${g.turnTimeoutSec}s turn` : '30s turn'}
              </Text>
            </View>
          </View>
        </AppCard>

        {failure ? (
          <Text testID="invitation-error" accessibilityRole="alert" style={[type.small, { color: c.danger, textAlign: 'center' }]}>
            {failure}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  name: {
    fontSize: 17,
    fontFamily: fonts.body.semibold,
  },
  sub: {
    fontSize: 12,
    fontFamily: fonts.mono.medium,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 11.5,
    fontFamily: fonts.body.semibold,
  },
});
