import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { ActionButton } from '../../components/game/ActionButton';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { GameBoard } from '../../components/game/GameBoard';
import { fonts } from '../../design-system/typography';
import { formatClock, useOnlineGame } from '../../hooks/useOnlineGame';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import type { Game } from '../../services/api/types';
import { openGame, requestRematch } from '../../services/onlineActions';

import { useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';
import { isOfflineError } from './shared';

import { fs, ms } from '../../design-system/responsive';
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
      toast.error("Can't start a rematch", friendlyMessage(e));
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
  const title = isWin ? 'You won' : isLoss ? 'You lost' : "It's a draw";
  const pts = myPlayer?.pointsAwarded ?? 0;
  const eloTotal = authMe?.stats?.points;
  const totalMoves = shown.moveCount ?? shown.board.filter((x) => x !== '').length;

  return (
    <Screen
      title=""
      onBack={toLobby}
      scroll={false}
      padded={false}
      footer={
        <View style={styles.footer}>
          <ActionButton
            testID="rematch"
            title={rematch.requestedByMe ? 'Waiting for opponent...' : rematch.requestedByOpponent ? 'Accept Rematch' : 'Request Rematch'}
            fullWidth
            loading={rematching}
            disabled={rematch.requestedByMe}
            onPress={askRematch}
          />
          <ActionButton
            testID="back-lobby"
            title="Back to Lobby"
            variant="secondary"
            compact
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

          {/* Points pill */}
          <View style={styles.eloPill}>
            <Text style={styles.eloPillText}>
              {pts >= 0 ? '+' : ''}{pts} points{eloTotal != null ? ` (${eloTotal.toLocaleString()})` : ''}
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
            maxSize={136}
          />
        </View>

        {/* 2-col Stats Card */}
        <View style={[styles.statsCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={[styles.statCol, { borderRightWidth: 1, borderRightColor: c.border }]}>
            <Text style={[styles.statVal, { color: c.text }]}>{totalMoves} Moves</Text>
            <Text style={[styles.statLabel, { color: c.textSecondary }]}>Turns</Text>
          </View>
          <View style={styles.statCol}>
            <Text testID="result-duration" style={[styles.statVal, { color: c.text }]}>{shown.durationMs != null ? formatClock(Math.round(shown.durationMs / 1000)) : '--:--'}</Text>
            <Text style={[styles.statLabel, { color: c.textSecondary }]}>Duration</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: ms(20),
    paddingTop: ms(16),
    alignItems: 'center',
    gap: ms(14),
  },
  badgeWrap: {
    alignItems: 'center',
    gap: ms(8),
  },
  outcomeBadge: {
    paddingHorizontal: ms(12),
    paddingVertical: ms(2),
    borderRadius: 999,
    borderWidth: 1,
  },
  outcomeBadgeText: {
    fontSize: fs(11),
    fontFamily: fonts.body.semibold,
  },
  eloPill: {
    paddingHorizontal: ms(14),
    paddingVertical: ms(6),
    marginTop: 0,
    borderRadius: ms(11),
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  eloPillText: {
    fontSize: fs(14),
    fontFamily: fonts.mono.semibold,
    color: '#1D4ED8',
  },
  boardPreview: {
    marginTop: -2,
  },
  statsCard: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: ms(10),
    paddingHorizontal: ms(12),
    borderRadius: ms(14),
    borderWidth: 1,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(2),
  },
  statVal: {
    fontSize: fs(13.5),
    fontFamily: fonts.mono.semibold,
  },
  statLabel: {
    fontSize: fs(10),
    fontFamily: fonts.body.regular,
  },
  footer: {
    paddingHorizontal: ms(20),
    paddingTop: ms(8),
    paddingBottom: ms(16),
    gap: ms(8),
  },
});
