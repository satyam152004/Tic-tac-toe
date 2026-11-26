import { WifiOff } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { ConfirmDialog } from '../../components/common/AppModal';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { DrawOfferModal } from '../../components/game/DrawOfferModal';
import { GameBoardView } from '../../components/game/GameBoardView';
import { PausedOverlay } from '../../components/game/PausedOverlay';
import { ms } from '../../design-system/responsive';
import { chooseMove } from '../../game-engine';
import { usePublicProfile } from '../../hooks/queries';
import { useBackGuard } from '../../hooks/useBackGuard';
import { useDrawOffer } from '../../hooks/useDrawOffer';
import { useLocalGameRunner } from '../../hooks/useLocalGameRunner';
import { formatClock, useCountdown, useOnlineGame } from '../../hooks/useOnlineGame';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { matchFoundSource } from '../../services/gameRoute';
import { userApi } from '../../services/api/userApi';
import { forfeitGame, joinGame, openGame, submitMove } from '../../services/onlineActions';
import { useAuthStore } from '../../store/authStore';
import { seatsOf, useLocalGameStore } from '../../store/localGameStore';
import { useOnlineStore } from '../../store/onlineStore';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';
import { formatDurationMs } from '../../utils/format';
import { isOfflineError } from '../online/shared';

const AI_LABEL = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard', EXPERT: 'Expert', IMPOSSIBLE: 'Unbeatable' } as const;
/** Hints available in one game (Computer and Pass n play). */
const HINTS_PER_GAME = 3;
const RESULT_DELAY_MS = 800;
const RECONNECT_SCREEN_AFTER_MS = 8000;

/**
 * THE game board screen for every mode. The route decides the source:
 *  - no `gameId` param -> a local game (Pass n play, vs Computer), played on this phone.
 *  - `gameId` param    -> an online or friend-room match, played on the server.
 * Both sources draw with GameBoardView. Each source has its own part below, so only the online part loads profiles.
 */
export const GameBoardScreen: React.FC<{ route: { params?: { gameId: string } } }> = ({ route }) => {
  const gameId = route.params?.gameId;
  return gameId ? <OnlineBoard key={gameId} gameId={gameId} /> : <LocalBoard />;
};

// ============================================================================
// Local game: Pass n play and vs Computer (plays on this phone)
// ============================================================================
const LocalBoard: React.FC = () => {
  const { nav, goHome } = useAppNav();
  const game = useLocalGameStore((s) => s.game);
  const setup = useLocalGameStore((s) => s.setup);
  const paused = useLocalGameStore((s) => s.paused);
  const pauseReason = useLocalGameStore((s) => s.pauseReason);
  const lastMove = useLocalGameStore((s) => s.lastMove);
  const soundOn = useSettingsStore((s) => s.soundEffects);
  const inProgress = game?.outcome.status === 'IN_PROGRESS';

  // Hints are free in Computer and Pass n play. The suggestion clears as soon as a move is made.
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  useEffect(() => {
    setHintIndex(null);
  }, [game?.moves.length]);
  // Each new game gets its full set of hints back.
  useEffect(() => {
    setHintsUsed(0);
  }, [game?.startedAt]);
  const hintsLeft = Math.max(0, HINTS_PER_GAME - hintsUsed);
  const onHint = () => {
    const g = useLocalGameStore.getState().game;
    if (!g || g.outcome.status !== 'IN_PROGRESS' || hintsLeft === 0) return;
    // The strongest engine level gives the best suggestion.
    setHintIndex(chooseMove(g.board, g.config, g.current, 'EXPERT'));
    setHintsUsed((n) => n + 1);
  };

  // Same setting as Settings → Sound Effects: saved locally at once, and to the account when signed in (reverted on failure).
  const toggleSound = () => {
    const next = !soundOn;
    useSettingsStore.getState().set({ soundEffects: next });
    if (useAuthStore.getState().status !== 'signedIn') return;
    userApi.update({ sound: { effects: next } }).catch(() => {
      useSettingsStore.getState().set({ soundEffects: soundOn });
      toast.error("Couldn't save setting");
    });
  };

  // Also while paused: leaving a paused match still discards it, so it is confirmed like any other exit.
  const guard = useBackGuard({
    when: !!game && !!inProgress,
    title: 'Leave Match?',
    message: 'You will lose this round.',
    confirmLabel: 'Leave',
    onLeave: () => useLocalGameStore.getState().quit(),
  });
  const { elapsedMs, aiThinking } = useLocalGameRunner(() => {
    guard.allow();
    nav.replace('game_result');
  });

  const missing = !game;
  useEffect(() => {
    if (missing) {
      guard.allow();
      goHome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  if (!game) return null;
  const seats = seatsOf(setup);
  const isVsAi = game.mode === 'VS_AI';
  const out = game.outcome;
  const nameOf = (mark: 'X' | 'O') => seats[mark].name;
  const statusText =
    out.status === 'WIN'
      ? `${nameOf(out.winner)} Wins`
      : out.status === 'DRAW'
        ? 'Draw'
        : paused
          ? 'Paused'
          : isVsAi
            ? game.current === game.humanMark
              ? `Your turn (${game.current})`
              : 'AI is thinking...'
            : `${nameOf(game.current)} (${game.current})`;
  const nameForChip = (mark: 'X' | 'O') => (isVsAi && !seats[mark].isP1 ? `AI ${AI_LABEL[game.difficulty ?? 'MEDIUM']}` : nameOf(mark));
  const boardLocked = !inProgress || paused || aiThinking;
  const canHint = !boardLocked && hintsLeft > 0 && (game.mode !== 'VS_AI' || game.current === game.humanMark);
  const titleText = isVsAi ? `vs Computer, ${AI_LABEL[game.difficulty ?? 'MEDIUM']}` : 'Pass n play';
  const subtitleText = `${game.config.size}×${game.config.size} grid, ${game.config.winLength} in a row`;
  const turnText = out.status === 'IN_PROGRESS' ? (paused ? 'Paused' : `Turn: ${nameOf(game.current)} (${game.current})`) : statusText;

  return (
    <GameBoardView
      testID="offline-board"
      title={titleText}
      subtitle={subtitleText}
      onBack={() => nav.goBack()}
      controls={{
        mode: 'local',
        onPause: () => useLocalGameStore.getState().pause('manual'),
        pauseDisabled: !inProgress || paused,
        onUndo: () => useLocalGameStore.getState().undoMove(),
        undoDisabled: game.moves.length === 0 || paused || !inProgress,
        onHint,
        hintsLeft,
        hintDisabled: !canHint,
        onRestart: () => useLocalGameStore.getState().rematch(),
        restartDisabled: !inProgress,
      }}
      overlay={
        paused && inProgress ? (
          <PausedOverlay
            matchLabel={`${seats.X.name} vs ${seats.O.name}`}
            elapsedLabel={formatDurationMs(elapsedMs)}
            reason={pauseReason}
            onResume={() => useLocalGameStore.getState().unpause()}
            onRestart={() => useLocalGameStore.getState().rematch()}
            onSettings={() => nav.navigate('settings')}
            onExit={() => {
              // quit() empties the store; allow the back guard first so leaving does not ask a second time.
              guard.allow();
              useLocalGameStore.getState().quit();
              goHome();
            }}
            soundOn={soundOn}
            onToggleSound={toggleSound}
          />
        ) : null
      }
      seats={[
        { testID: 'board-score-X', name: nameForChip('X'), symbol: 'X', subtitle: `Score ${game.scores.X}`, isActive: !!inProgress && game.current === 'X' },
        { testID: 'board-score-O', name: nameForChip('O'), symbol: 'O', subtitle: `Score ${game.scores.O}`, isActive: !!inProgress && game.current === 'O' },
      ]}
      turnText={turnText}
      clock={formatDurationMs(elapsedMs)}
      clockTestID="board-timer"
      board={{
        board: game.board,
        size: game.config.size,
        winningLine: out.status === 'WIN' ? out.line : null,
        lastMoveIndex: lastMove,
        hintIndex,
        disabled: boardLocked,
        onCellPress: (i) => useLocalGameStore.getState().play(i),
      }}
    >
      <ConfirmDialog {...guard.dialog} />
    </GameBoardView>
  );
};

// ============================================================================
// Online game: ranked and friend rooms (played on the server)
// ============================================================================
const OnlineBoard: React.FC<{ gameId: string }> = ({ gameId }) => {
  const c = useTheme();
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
      nav.replace('match_found', { gameId: rematchGameId, source: matchFoundSource(game?.type) });
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

  const oppMark = myMark === 'X' ? 'O' : 'X';
  const oppName = opponentCard?.displayName ?? 'Opponent';
  const oppElo = opponentProfile.data?.stats.points ?? '–';
  const myElo = me?.stats?.points ?? '–';
  const turnClock = secondsLeft !== null ? formatClock(secondsLeft) : '--:--';
  const turnPct = secondsLeft !== null ? Math.min(100, Math.max(5, Math.round((secondsLeft / (game?.turnTimeoutSec || 30)) * 100))) : 100;

  return (
    <GameBoardView
      testID="online-board"
      title="Online Ranked"
      onBack={() => nav.goBack()}
      progress={turnPct}
      banner={
        opponentOffline && !finished ? (
          <View testID="opponent-offline-banner" accessibilityRole="alert" style={[styles.banner, { backgroundColor: c.warning + '26', borderColor: c.warning + '66' }]}>
            <WifiOff size={ms(18)} color={c.warning} />
            <Text style={[styles.bannerText, { color: c.text }]}>
              {oppName} disconnected. They lose in {formatClock(graceLeft ?? 0)} if they don&apos;t come back.
            </Text>
          </View>
        ) : null
      }
      overlay={
        reconnecting && !finished ? (
          <View testID="reconnecting-overlay" accessibilityRole="alert" style={[styles.overlay, { backgroundColor: c.bgPrimary + 'E6' }]}>
            <AppLoader label="Reconnecting..." sublabel="Your spot is saved while we reconnect." />
            {longReconnect ? <AppButton testID="open-reconnection" title="Reconnect options" variant="secondary" onPress={() => nav.navigate('reconnection', { gameId })} /> : null}
          </View>
        ) : null
      }
      seats={[
        { testID: 'board-seat-me', name: 'You', symbol: myMark ?? 'X', subtitle: `Rating ${myElo}`, isActive: isMyTurn },
        {
          testID: 'board-seat-opponent',
          name: oppName,
          symbol: oppMark,
          subtitle: `Rating ${oppElo}${opponentCard?.online !== false ? ' • Online' : ' • Offline'}`,
          isActive: active && !isMyTurn,
        },
      ]}
      turnText={isMyTurn ? 'Your turn' : `${oppName}'s turn`}
      clock={turnClock}
      clockTestID="turn-timer"
      controls={{
        mode: 'online',
        onOfferDraw: () => setConfirmDraw(true),
        offerDrawDisabled: !active || draw.sent || draw.busy,
        onGiveUp: () => setConfirmForfeit(true),
        giveUpDisabled: !active,
      }}
      board={{
        board: mine.board,
        size: mine.boardSize,
        winningLine: mine.result?.line ?? null,
        lastMoveIndex: lastMove,
        disabled: !canMove,
        onCellPress: (i) => void submitMove(i),
      }}
    >
      <ConfirmDialog {...guard.dialog} />

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
    </GameBoardView>
  );
};

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: ms(8), borderWidth: 1, borderRadius: ms(12), padding: ms(8) },
  bannerText: { flex: 1, fontSize: ms(12) },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: ms(12) },
});
