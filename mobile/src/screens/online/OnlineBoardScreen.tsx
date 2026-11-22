import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Flag, Handshake } from 'lucide-react-native';
import { ConfirmDialog } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { GameBoard } from '../../components/game/GameBoard';
import { fonts, type } from '../../design-system/typography';
import { formatClock, useCountdown, useOnlineGame } from '../../hooks/useOnlineGame';
import { useBackGuard } from '../../hooks/useBackGuard';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { forfeitGame, joinGame, openGame, submitMove } from '../../services/onlineActions';
import { useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';
import { isOfflineError } from './shared';

const RESULT_DELAY_MS = 800;
const RECONNECT_SCREEN_AFTER_MS = 8000;

export const OnlineBoardScreen: React.FC<RootScreenProps<'online_board'>> = ({ route }) => {
  const c = useTheme();
  const { gameId } = route.params;
  const { nav } = useAppNav();
  const { game, me, myMark, opponentCard, isMyTurn, canMove, secondsLeft, finished } = useOnlineGame();
  const lastMove = useOnlineStore((s) => s.lastMove);
  const moveError = useOnlineStore((s) => s.moveError);
  const reconnecting = useOnlineStore((s) => s.reconnecting);
  const rematchGameId = useOnlineStore((s) => s.rematchGameId);

  const [loadError, setLoadError] = useState<unknown>(null);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [longReconnect, setLongReconnect] = useState(false);
  const booted = useRef<string | null>(null);

  const mine = game && game.id === gameId ? game : null;
  const active = !!mine && !finished;
  const guard = useBackGuard({
    when: active,
    title: 'Leave the match?',
    message: 'Leaving forfeits this online match to your opponent.',
    confirmLabel: 'Forfeit',
    onLeave: () => void forfeitGame(gameId).catch(() => undefined),
  });

  const boot = useCallback(async () => {
    setLoadError(null);
    try {
      const cur = useOnlineStore.getState().game;
      const g = cur && cur.id === gameId ? cur : await openGame(gameId);
      if (g.status === 'WAITING' || g.status === 'READY') await joinGame(gameId);
    } catch (e) {
      setLoadError(e);
    }
  }, [gameId]);

  useEffect(() => {
    if (booted.current === gameId) return;
    booted.current = gameId;
    void boot();
  }, [gameId, boot]);

  useEffect(() => {
    if (!mine || !finished) return;
    const t = setTimeout(() => {
      guard.allow();
      nav.replace('online_result', { gameId });
    }, RESULT_DELAY_MS);
    return () => clearTimeout(t);
  }, [mine?.status, finished, gameId, guard, nav]);

  useEffect(() => {
    if (rematchGameId && rematchGameId !== gameId) {
      guard.allow();
      nav.replace('online_board', { gameId: rematchGameId });
    }
  }, [rematchGameId, gameId, guard, nav]);

  useEffect(() => {
    if (!moveError) return;
    toast.error('Move not allowed', friendlyMessage({ code: moveError.code, message: moveError.message }));
    useOnlineStore.getState().setMoveError(null);
  }, [moveError]);

  useEffect(() => {
    if (!reconnecting) {
      setLongReconnect(false);
      return;
    }
    const t = setTimeout(() => setLongReconnect(true), RECONNECT_SCREEN_AFTER_MS);
    return () => clearTimeout(t);
  }, [reconnecting]);

  const doForfeit = async () => {
    setConfirmForfeit(false);
    try {
      await forfeitGame(gameId);
    } catch (e) {
      toast.error('Could not forfeit', friendlyMessage(e));
    }
  };

  const oppMark = myMark === 'X' ? 'O' : 'X';
  const oppName = opponentCard?.displayName ?? 'Aarav';
  const oppElo = 1540;
  const myElo = me?.stats?.points ?? 1498;
  const turnClock = secondsLeft !== null ? formatClock(secondsLeft) : '00:30';
  const turnPct = secondsLeft !== null ? Math.min(100, Math.max(5, Math.round((secondsLeft / 30) * 100))) : 100;

  if (loadError && !mine) {
    return (
      <Screen title="Online Ranked" onBack={() => nav.goBack()}>
        <ErrorState offline={isOfflineError(loadError)} title={toApiError(loadError).code === 'GAME_NOT_FOUND' ? 'Game not found' : undefined} message={friendlyMessage(loadError)} onRetry={() => void boot()} />
      </Screen>
    );
  }

  if (!mine) {
    return (
      <Screen title="Online Ranked" onBack={() => nav.goBack()}>
        <AppLoader label="Loading match..." />
      </Screen>
    );
  }

  return (
    <Screen
      title="Online Ranked"
      onBack={() => nav.goBack()}
      scroll={false}
      padded={false}
      rightAction={
        <Text testID="turn-timer" style={styles.headerTimer}>
          {turnClock}
        </Text>
      }
    >
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16, justifyContent: 'space-between' }}>
        {/* Turn Progress Bar */}
        <View style={[styles.progressTrack, { backgroundColor: c.bgSecondary }]}>
          <View style={[styles.progressFill, { width: `${turnPct}%`, backgroundColor: c.accent }]} />
        </View>

        {/* Opponent Card (Top) */}
        <View style={[styles.playerCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: '#141518' }]}>
                <Text style={styles.avatarText}>{oppName.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.onlineBadge} />
            </View>
            <Text style={[styles.playerName, { color: c.text }]}>
              {oppName} ({oppMark}) • Online
            </Text>
          </View>
          <Text style={[styles.playerElo, { color: c.textSecondary }]}>{oppElo}</Text>
        </View>

        {/* Board */}
        <View style={styles.boardWrap}>
          <GameBoard
            board={mine.board}
            size={mine.boardSize}
            winningLine={mine.result?.line ?? null}
            lastMoveIndex={lastMove}
            disabled={!canMove}
            onCellPress={(i) => void submitMove(i)}
          />
        </View>

        {/* Player Card & Control Actions (Bottom) */}
        <View style={{ gap: 10 }}>
          <View
            style={[
              styles.playerCard,
              {
                backgroundColor: c.bgCard,
                borderColor: isMyTurn ? c.accent : c.border,
                borderWidth: isMyTurn ? 1.5 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.markText, { color: c.accent }]}>✕</Text>
              <Text style={[styles.playerName, { color: c.text }]}>
                You ({myMark ?? 'X'}) • {isMyTurn ? 'Your Turn' : 'Waiting'}
              </Text>
            </View>
            <Text style={[styles.playerElo, { color: c.accent }]}>{myElo}</Text>
          </View>

          {/* Offer Draw & Forfeit */}
          <View style={styles.actionRow}>
            <Pressy
              testID="offer-draw"
              accessibilityLabel="Offer Draw"
              disabled={!active}
              onPress={() => setConfirmDraw(true)}
              style={[styles.btnAction, { backgroundColor: c.bgCard, borderColor: c.border }]}
            >
              <Handshake size={15} color={c.text} />
              <Text style={[styles.btnActionText, { color: c.text }]}>Offer Draw</Text>
            </Pressy>

            <Pressy
              testID="forfeit"
              accessibilityLabel="Forfeit"
              disabled={!active}
              onPress={() => setConfirmForfeit(true)}
              style={[styles.btnAction, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}
            >
              <Flag size={15} color="#DC2626" />
              <Text style={[styles.btnActionText, { color: '#DC2626' }]}>Forfeit</Text>
            </Pressy>
          </View>
        </View>
      </View>

      <ConfirmDialog
        open={confirmDraw}
        title="Offer Mutual Draw?"
        message="Propose a draw to your opponent (0 ELO rating change if accepted)."
        confirmLabel="Send Draw Offer"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmDraw(false);
          toast.info('Draw offer sent', 'Waiting for opponent response');
        }}
        onCancel={() => setConfirmDraw(false)}
      />

      <ConfirmDialog
        open={confirmForfeit}
        title="Forfeit Match?"
        message="Forfeiting gives this ranked online match to your opponent."
        confirmLabel="Forfeit"
        cancelLabel="Continue"
        destructive
        onConfirm={doForfeit}
        onCancel={() => setConfirmForfeit(false)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerTimer: {
    fontSize: 12.5,
    fontFamily: fonts.mono.semibold,
    color: '#1D4ED8',
    paddingHorizontal: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 10,
    fontFamily: fonts.mono.semibold,
    color: '#FFFFFF',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#15803D',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  playerName: {
    fontSize: 12.5,
    fontFamily: fonts.body.semibold,
  },
  playerElo: {
    fontSize: 11.5,
    fontFamily: fonts.mono.semibold,
  },
  markText: {
    fontSize: 14,
    fontFamily: fonts.mono.semibold,
  },
  boardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnAction: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnActionText: {
    fontSize: 12,
    fontFamily: fonts.body.semibold,
  },
});
