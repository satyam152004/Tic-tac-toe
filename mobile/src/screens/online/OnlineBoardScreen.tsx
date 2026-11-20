import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Flag, Handshake, Volume2, VolumeX, WifiOff } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { ConfirmDialog } from '../../components/common/AppModal';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { GameBoard } from '../../components/game/GameBoard';
import { PlayerCard } from '../../components/game/PlayerCard';
import { withAlpha } from '../../design-system/colors';
import { type } from '../../design-system/typography';
import { formatClock, useCountdown, useOnlineGame } from '../../hooks/useOnlineGame';
import { useBackGuard } from '../../hooks/useBackGuard';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { forfeitGame, joinGame, openGame, submitMove } from '../../services/onlineActions';
import { useOnlineStore } from '../../store/onlineStore';
import { useSettingsStore } from '../../store/settingsStore';
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
  const opponentOffline = useOnlineStore((s) => s.opponentOffline);
  const reconnecting = useOnlineStore((s) => s.reconnecting);
  const rematchGameId = useOnlineStore((s) => s.rematchGameId);
  const soundOn = useSettingsStore((s) => s.soundEffects);
  const setSettings = useSettingsStore((s) => s.set);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.status, finished, gameId]);

  useEffect(() => {
    if (rematchGameId && rematchGameId !== gameId) {
      guard.allow();
      nav.replace('online_board', { gameId: rematchGameId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rematchGameId]);

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

  const graceLeft = useCountdown(opponentOffline ? opponentOffline.since + opponentOffline.graceSeconds * 1000 : null);

  const doForfeit = async () => {
    setConfirmForfeit(false);
    try {
      await forfeitGame(gameId);
    } catch (e) {
      toast.error('Could not forfeit', friendlyMessage(e));
    }
  };

  let body: React.ReactNode;
  if (loadError && !mine) {
    body = <ErrorState offline={isOfflineError(loadError)} title={toApiError(loadError).code === 'GAME_NOT_FOUND' ? 'Game not found' : undefined} message={friendlyMessage(loadError)} onRetry={() => void boot()} />;
  } else if (!mine) {
    body = <AppLoader label="Loading match..." />;
  } else {
    const oppMark = myMark === 'X' ? 'O' : 'X';
    const count = (m: string) => mine.board.filter((x) => x === m).length;
    const running = mine.status === 'IN_PROGRESS';
    const oppName = opponentCard?.displayName ?? 'Opponent';
    const status = !running ? (finished ? 'Match finished' : 'Waiting for the match to start...') : isMyTurn ? 'Your turn to move' : `${oppName} is thinking...`;
    body = (
      <>
        <View style={styles.cards}>
          <PlayerCard name={me?.displayName ?? 'You'} avatarId={me?.avatar} symbol={myMark ?? 'X'} score={count(myMark ?? 'X')} isActive={running && isMyTurn} subtitle="You" />
          <PlayerCard name={oppName} avatarId={opponentCard?.avatar} symbol={oppMark} score={count(oppMark)} isActive={running && !isMyTurn} activeLabel="Thinking" subtitle="Opponent" />
        </View>

        {opponentOffline && !finished ? (
          <View testID="opponent-offline-banner" accessibilityRole="alert" style={[styles.banner, { backgroundColor: withAlpha(c.warning, 0.16), borderColor: withAlpha(c.warning, 0.4) }]}>
            <WifiOff size={16} color={c.warning} />
            <Text style={[type.small, { color: c.text, flex: 1 }]}>
              {oppName} disconnected. They forfeit in {formatClock(graceLeft ?? 0)} unless they come back.
            </Text>
          </View>
        ) : null}

        <View style={[styles.turnBar, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text testID="turn-status" style={[type.small, { color: c.textSecondary, flex: 1 }]}>{status}</Text>
          {running && secondsLeft !== null ? (
            <Text testID="turn-timer" style={[type.num, { color: secondsLeft <= 5 ? c.danger : c.warning }]}>
              {formatClock(secondsLeft)}
            </Text>
          ) : null}
        </View>

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

        <View style={styles.actions}>
          <AppButton
            testID="mute-toggle"
            title={soundOn ? 'Audio' : 'Muted'}
            variant="secondary"
            size="md"
            icon={soundOn ? <Volume2 size={16} color={c.text} /> : <VolumeX size={16} color={c.text} />}
            onPress={() => setSettings({ soundEffects: !soundOn })}
            style={{ flex: 1 }}
          />
          <AppButton
            testID="offer-draw"
            title="Draw"
            variant="outline"
            size="md"
            icon={<Handshake size={16} color={c.accent} />}
            disabled={!active}
            onPress={() => setConfirmDraw(true)}
            style={{ flex: 1 }}
          />
          <AppButton testID="forfeit" title="Forfeit" variant="danger" size="md" icon={<Flag size={16} color={c.dangerText} />} disabled={!active} onPress={() => setConfirmForfeit(true)} style={{ flex: 1 }} />
        </View>
      </>
    );
  }

  return (
    <Screen
      title="Online Match"
      subtitle={reconnecting ? 'Reconnecting...' : 'Connected'}
      onBack={() => nav.goBack()}
    >
      {body}
      {reconnecting && mine && !finished ? (
        <View testID="reconnecting-overlay" accessibilityRole="alert" style={[styles.overlay, { backgroundColor: withAlpha(c.bgPrimary, 0.9) }]}>
          <AppLoader label="Reconnecting..." sublabel="Your seat is kept while we restore the connection." />
          {longReconnect ? <AppButton testID="open-reconnection" title="Open Reconnection Screen" variant="secondary" onPress={() => nav.navigate('reconnection', { gameId })} /> : null}
        </View>
      ) : null}
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
  cards: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  turnBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  boardWrap: { paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
