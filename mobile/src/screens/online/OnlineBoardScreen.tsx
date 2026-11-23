import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { ConfirmDialog } from '../../components/common/AppModal';
import { ActionButton } from '../../components/game/ActionButton';
import { BoardArea } from '../../components/game/BoardArea';
import { useGameLayout } from '../../hooks/useGameLayout';
import { SymbolMark } from '../../components/game/SymbolMark';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { DrawOfferModal } from '../../components/game/DrawOfferModal';
import { fonts, type } from '../../design-system/typography';
import { formatClock, useCountdown, useOnlineGame } from '../../hooks/useOnlineGame';
import { useBackGuard } from '../../hooks/useBackGuard';
import { useDrawOffer } from '../../hooks/useDrawOffer';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { forfeitGame, joinGame, openGame, submitMove } from '../../services/onlineActions';
import { usePublicProfile } from '../../hooks/queries';
import { useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';
import { isOfflineError } from './shared';

import { ch, fs, ms } from '../../design-system/responsive';
const RESULT_DELAY_MS = 800;
const RECONNECT_SCREEN_AFTER_MS = 8000;

export const OnlineBoardScreen: React.FC<RootScreenProps<'online_board'>> = ({ route }) => {
  const c = useTheme();
  const layout = useGameLayout();
  const { gameId } = route.params;
  const { nav } = useAppNav();
  const { game, me, myMark, opponentCard, isMyTurn, canMove, secondsLeft, finished } = useOnlineGame();
  const draw = useDrawOffer(game, me?.id);
  const opponentProfile = usePublicProfile(opponentCard?.id ?? '');
  const lastMove = useOnlineStore((s) => s.lastMove);
  const moveError = useOnlineStore((s) => s.moveError);
  const reconnecting = useOnlineStore((s) => s.reconnecting);
  const opponentOffline = useOnlineStore((s) => s.opponentOffline);
  const graceLeft = useCountdown(opponentOffline ? opponentOffline.since + opponentOffline.graceSeconds * 1000 : null);
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
    message: 'If you leave, your opponent wins.',
    confirmLabel: 'Give up',
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
    toast.error("Can't move there", friendlyMessage({ code: moveError.code, message: moveError.message }));
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
      toast.error('Could not give up', friendlyMessage(e));
    }
  };

  const oppMark = myMark === 'X' ? 'O' : 'X';
  const oppName = opponentCard?.displayName ?? 'Opponent';
  const oppElo = opponentProfile.data?.stats.points ?? '–';
  const myElo = me?.stats?.points ?? '–';
  const turnClock = secondsLeft !== null ? formatClock(secondsLeft) : '--:--';
  const turnPct = secondsLeft !== null ? Math.min(100, Math.max(5, Math.round((secondsLeft / (game?.turnTimeoutSec || 30)) * 100))) : 100;

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
        <Text testID="turn-timer" style={styles.headerTimer} numberOfLines={1}>
          {turnClock}
        </Text>
      }
    >
      <View style={{ flex: 1, paddingHorizontal: ms(20), paddingTop: ms(2), paddingBottom: ms(16), justifyContent: 'space-between' }}>
        {/* Turn Progress Bar */}
        <View style={[styles.progressTrack, { backgroundColor: c.bgSecondary }]}>
          <View style={[styles.progressFill, { width: `${turnPct}%`, backgroundColor: c.accent }]} />
        </View>

        {opponentOffline && !finished ? (
          <View testID="opponent-offline-banner" accessibilityRole="alert" style={[styles.banner, { backgroundColor: c.warning + '26', borderColor: c.warning + '66' }]}>
            <WifiOff size={ms(18)} color={c.warning} />
            <Text style={[styles.playerName, { color: c.text, flex: 1 }]}>
              {oppName} disconnected. They lose in {formatClock(graceLeft ?? 0)} if they don't come back.
            </Text>
          </View>
        ) : null}

        {/* Opponent Card (Top) */}
        <View style={[styles.playerCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: ms(10) }}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: '#141518' }]}>
                <Text style={styles.avatarText}>{oppName.slice(0, 2).toUpperCase()}</Text>
              </View>
              {opponentCard?.online !== false ? <View style={styles.onlineBadge} /> : null}
            </View>
            <Text style={[styles.playerName, { color: c.text }]}>
              {oppName} ({oppMark}){opponentCard?.online !== false ? ' • Online' : ' • Offline'}
            </Text>
          </View>
          <Text style={[styles.playerElo, { color: c.textSecondary }]}>{oppElo}</Text>
        </View>

        {/* Board */}
        <View style={styles.boardWrap}>
          <BoardArea
            initial={layout.estimate}
            board={mine.board}
            size={mine.boardSize}
            winningLine={mine.result?.line ?? null}
            lastMoveIndex={lastMove}
            disabled={!canMove}
            onCellPress={(i) => void submitMove(i)}
          />
        </View>

        {/* Player Card & Control Actions (Bottom) */}
        <View style={{ gap: ms(10) }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: ms(8) }}>
              <SymbolMark value={myMark ?? 'X'} size={ms(18)} animate={false} />
              <Text style={[styles.playerName, { color: c.text }]}>
                You ({myMark ?? 'X'}) • {isMyTurn ? 'Your Turn' : 'Their turn'}
              </Text>
            </View>
            <Text style={[styles.playerElo, { color: c.accent }]}>{myElo}</Text>
          </View>

          {/* Offer Draw & Forfeit */}
          <View style={styles.actionRow}>
            <ActionButton
              testID="offer-draw"
              title="Offer Draw"
              variant="secondary"
              compact
              style={styles.flex}
              disabled={!active || draw.sent || draw.busy}
              onPress={() => setConfirmDraw(true)}
            />
            <ActionButton testID="forfeit" title="Give up" variant="danger" compact style={styles.flex} disabled={!active} onPress={() => setConfirmForfeit(true)} />
          </View>
        </View>
      </View>

      {reconnecting && !finished ? (
        <View testID="reconnecting-overlay" accessibilityRole="alert" style={[styles.overlay, { backgroundColor: c.bgPrimary + 'E6' }]}>
          <AppLoader label="Reconnecting..." sublabel="Your spot is saved while we reconnect." />
          {longReconnect ? <AppButton testID="open-reconnection" title="Reconnect options" variant="secondary" onPress={() => nav.navigate('reconnection', { gameId })} /> : null}
        </View>
      ) : null}

      <ConfirmDialog
        open={confirmDraw}
        title="Offer a draw?"
        message="Ask for a draw. Your rating will not change if they accept."
        confirmLabel="Send offer"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmDraw(false);
          void draw.send();
        }}
        onCancel={() => setConfirmDraw(false)}
      />

      <DrawOfferModal
        open={!!draw.incoming}
        proposerName={oppName}
        expiresAt={draw.incoming?.expiresAt}
        moveCount={draw.incoming?.moveCount}
        onAccept={() => void draw.respond(true)}
        onDecline={() => void draw.respond(false)}
      />

      <ConfirmDialog
        open={confirmForfeit}
        title="Give up this match?"
        message="Your opponent will win."
        confirmLabel="Give up"
        cancelLabel="Keep playing"
        destructive
        onConfirm={doForfeit}
        onCancel={() => setConfirmForfeit(false)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: ms(8), borderWidth: 1, borderRadius: ms(12), padding: ms(8), marginBottom: ms(6) },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: ms(12) },
  flex: { flex: 1 },
  headerTimer: {
    fontSize: fs(11),
    fontFamily: fonts.mono.semibold,
    color: '#1D4ED8',
    paddingHorizontal: ms(8),
  },
  progressTrack: {
    height: ms(4.8),
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: ms(8),
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(12),
    paddingVertical: ms(8),
    borderRadius: ms(12),
    borderWidth: 1,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: ms(28.8),
    height: ms(28.8),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fs(9.5),
    fontFamily: fonts.body.semibold,
    color: '#FFFFFF',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: ms(8.4),
    height: ms(8.4),
    borderRadius: 999,
    backgroundColor: '#15803D',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  playerName: {
    fontSize: fs(11.5),
    fontFamily: fonts.body.semibold,
  },
  playerElo: {
    fontSize: fs(10.5),
    fontFamily: fonts.mono.semibold,
  },
  markText: {
    fontSize: fs(14),
    fontFamily: fonts.mono.semibold,
  },
  boardWrap: {
    flex: 1,
    paddingVertical: ms(8),
  },
  actionRow: {
    flexDirection: 'row',
    gap: ms(10),
  },
  btnAction: {
    flex: 1,
    height: ch(40),
    borderRadius: ms(10),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(6),
  },
  btnActionText: {
    fontSize: fs(12),
    fontFamily: fonts.body.semibold,
  },
});
