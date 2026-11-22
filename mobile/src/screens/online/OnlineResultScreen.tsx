import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { GameBoard } from '../../components/game/GameBoard';
import { fonts, type } from '../../design-system/typography';
import { useOnlineGame } from '../../hooks/useOnlineGame';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import type { Game } from '../../services/api/types';
import { openGame, requestRematch } from '../../services/onlineActions';
import { useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';
import { isOfflineError } from './shared';

export const OnlineResultScreen: React.FC<RootScreenProps<'online_result'>> = ({ route }) => {
  const c = useTheme();
  const { gameId } = route.params;
  const { nav, goHome } = useAppNav();
  const { game, me: authMe } = useOnlineGame();
  const rematch = useOnlineStore((s) => s.rematch);
  const rematchGameId = useOnlineStore((s) => s.rematchGameId);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [rematching, setRematching] = useState(false);
  const last = useRef<Game | null>(null);

  if (game && game.id === gameId) last.current = game;
  const shown = last.current;

  useEffect(() => {
    if (game?.id === gameId) return;
    openGame(gameId).catch((e) => setLoadError(e));
  }, [gameId, game?.id]);

  useEffect(() => {
    if (rematchGameId && rematchGameId !== gameId) nav.replace('online_board', { gameId: rematchGameId });
  }, [rematchGameId, gameId, nav]);

  const askRematch = async () => {
    if (rematching || rematch.requestedByMe) return;
    setRematching(true);
    try {
      await requestRematch(gameId);
    } catch (e) {
      toast.error('Rematch unavailable', friendlyMessage(e));
    } finally {
      setRematching(false);
    }
  };

  const toLobby = () => nav.dispatch(CommonActions.reset({ index: 1, routes: [{ name: 'Main', params: { screen: 'HomeTab' } }, { name: 'online_lobby' }] }));

  if (!shown) {
    return (
      <Screen title="Match Result" onBack={goHome}>
        {loadError ? <ErrorState offline={isOfflineError(loadError)} message={friendlyMessage(loadError)} onRetry={() => openGame(gameId)} /> : <AppLoader label="Loading result..." />}
      </Screen>
    );
  }

  const myId = authMe?.id;
  const myPlayer = shown.players.find((p) => p.userId === myId);
  const isWin = myPlayer?.outcome === 'WIN';
  const isLoss = myPlayer?.outcome === 'LOSS';
  const title = isWin ? 'Ranked Victory' : isLoss ? 'Ranked Defeat' : 'Ranked Draw';
  const pts = myPlayer?.pointsAwarded ?? 18;
  const eloTotal = 1516;
  const totalMoves = shown.board.filter((x) => x !== '').length || 9;

  return (
    <Screen
      title=""
      onBack={toLobby}
      scroll={false}
      padded={false}
      footer={
        <View style={styles.footer}>
          <AppButton
            testID="rematch"
            title={rematch.requestedByMe ? 'Waiting for opponent...' : 'Request Rematch'}
            fullWidth
            loading={rematching}
            disabled={rematch.requestedByMe}
            onPress={askRematch}
          />
          <AppButton
            testID="back-lobby"
            title="Back to Lobby"
            variant="secondary"
            fullWidth
            onPress={toLobby}
          />
        </View>
      }
    >
      <View style={styles.content}>
        {/* Outcome Header Badge */}
        <View style={styles.badgeWrap}>
          <View
            style={[
              styles.outcomeBadge,
              {
                backgroundColor: isWin ? '#F0FDF4' : isLoss ? '#FEF2F2' : '#EFF4FF',
                borderColor: isWin ? '#BBF7D0' : isLoss ? '#FECACA' : '#BFDBFE',
              },
            ]}
          >
            <Text
              style={[
                styles.outcomeBadgeText,
                { color: isWin ? '#15803D' : isLoss ? '#DC2626' : '#1D4ED8' },
              ]}
            >
              {title}
            </Text>
          </View>

          {/* ELO Pill */}
          <View style={styles.eloPill}>
            <Text style={styles.eloPillText}>
              {pts >= 0 ? '+' : ''}{pts} ELO ({eloTotal})
            </Text>
          </View>
        </View>

        {/* Final Board Preview */}
        <View style={styles.boardPreview}>
          <GameBoard
            board={shown.board}
            size={shown.boardSize}
            winningLine={shown.result?.line ?? null}
            compact
            disabled
            maxSize={180}
          />
        </View>

        {/* 2-col Stats Card */}
        <AppCard padding="sm" style={styles.statsCard}>
          <View style={[styles.statCol, { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border }]}>
            <Text style={[styles.statVal, { color: c.text }]}>{totalMoves} Moves</Text>
            <Text style={[styles.statLabel, { color: c.textSecondary }]}>Total Turns</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statVal, { color: c.text }]}>01:34</Text>
            <Text style={[styles.statLabel, { color: c.textSecondary }]}>Duration</Text>
          </View>
        </AppCard>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
    gap: 16,
  },
  badgeWrap: {
    alignItems: 'center',
    gap: 8,
  },
  outcomeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  outcomeBadgeText: {
    fontSize: 12,
    fontFamily: fonts.body.semibold,
  },
  eloPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  eloPillText: {
    fontSize: 14,
    fontFamily: fonts.mono.semibold,
    color: '#1D4ED8',
  },
  boardPreview: {
    paddingVertical: 6,
  },
  statsCard: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 12,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  statVal: {
    fontSize: 14,
    fontFamily: fonts.mono.semibold,
  },
  statLabel: {
    fontSize: 10.5,
    fontFamily: fonts.body.medium,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 8,
  },
});
