import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Film, Home, RotateCcw } from 'lucide-react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { GameBoard } from '../../components/game/GameBoard';
import { ScoreCard } from '../../components/profile/Cards';
import { type } from '../../design-system/typography';
import { useMe, useReplay } from '../../hooks/queries';
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

type Outcome = 'WIN' | 'LOSS' | 'DRAW' | 'VOID';

/** Outcome/reason copy derived ONLY from the server's game (the client never decides a winner). */
export function describeResult(game: Game, myId: string | undefined): { outcome: Outcome; title: string; reason: string; points: number } {
  const me = game.players.find((p) => p.userId === myId);
  const voided = game.status === 'CANCELLED' || game.status === 'EXPIRED';
  const outcome: Outcome = voided ? 'VOID' : game.status === 'DRAW' || me?.outcome === 'DRAW' ? 'DRAW' : me?.outcome === 'WIN' ? 'WIN' : 'LOSS';
  const title = { WIN: 'You Win!', LOSS: 'You Lost', DRAW: "It's a Draw", VOID: game.status === 'EXPIRED' ? 'Match Expired' : 'Match Cancelled' }[outcome];
  const reasonCode = game.result?.reason ?? null;
  let reason = '';
  if (outcome === 'VOID') reason = 'No result was recorded for this match.';
  else if (reasonCode === 'LINE') reason = `${game.winLength} in a row`;
  else if (reasonCode === 'DRAW' || outcome === 'DRAW') reason = 'The board is full';
  else if (reasonCode === 'FORFEIT') reason = outcome === 'WIN' ? 'Your opponent forfeited' : 'You forfeited the match';
  else if (reasonCode === 'TIMEOUT') reason = outcome === 'WIN' ? 'Your opponent ran out of time' : 'You ran out of time';
  else if (reasonCode === 'DISCONNECT') reason = outcome === 'WIN' ? 'Your opponent disconnected' : 'You were disconnected';
  return { outcome, title, reason, points: me?.pointsAwarded ?? 0 };
}

export const OnlineResultScreen: React.FC<RootScreenProps<'online_result'>> = ({ route }) => {
  const c = useTheme();
  const { gameId } = route.params;
  const { nav, goHome } = useAppNav();
  const { game, me: authMe, opponentCard } = useOnlineGame();
  const meQuery = useMe();
  const rematch = useOnlineStore((s) => s.rematch);
  const rematchGameId = useOnlineStore((s) => s.rematchGameId);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [rematching, setRematching] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [step, setStep] = useState(0);
  const last = useRef<Game | null>(null);
  const fetched = useRef<string | null>(null);

  if (game && game.id === gameId) last.current = game;
  const shown = last.current;

  const load = () => {
    setLoadError(null);
    openGame(gameId).catch((e) => setLoadError(e));
  };
  useEffect(() => {
    if (game?.id === gameId || fetched.current === gameId) return;
    fetched.current = gameId;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    if (rematchGameId && rematchGameId !== gameId) nav.replace('online_board', { gameId: rematchGameId });
  }, [rematchGameId, gameId, nav]);

  const replay = useReplay(showReplay ? gameId : undefined);
  const frames = replay.data?.frames ?? [];

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
        {loadError ? <ErrorState offline={isOfflineError(loadError)} message={friendlyMessage(loadError)} onRetry={load} /> : <AppLoader label="Loading result..." />}
      </Screen>
    );
  }

  const myId = authMe?.id;
  const r = describeResult(shown, myId);
  const myPlayer = shown.players.find((p) => p.userId === myId);
  const stats = meQuery.data?.stats;
  const canRematch = r.outcome !== 'VOID';
  const tone = r.outcome === 'WIN' ? c.success : r.outcome === 'LOSS' ? '#F87171' : c.warning;
  const progress = stats && stats.xpForNextLevel > stats.xpForCurrentLevel ? Math.round(((stats.xp - stats.xpForCurrentLevel) / (stats.xpForNextLevel - stats.xpForCurrentLevel)) * 100) : null;
  const oppName = opponentCard?.displayName ?? 'Opponent';
  const frameBoard = step === 0 ? Array(shown.boardSize * shown.boardSize).fill('') : frames[step - 1]?.board ?? shown.board;

  return (
    <Screen
      title="Match Result"
      onBack={toLobby}
      footer={
        <>
          <AppButton
            testID="rematch"
            title={rematch.requestedByMe ? 'Waiting for opponent...' : rematch.requestedByOpponent ? 'Accept Rematch' : 'Request Rematch'}
            fullWidth
            icon={<RotateCcw size={16} color="#FFFFFF" />}
            loading={rematching}
            disabled={!canRematch || rematch.requestedByMe}
            onPress={askRematch}
          />
          <View style={styles.row}>
            <AppButton testID="back-lobby" title="Return to Lobby" variant="outline" style={{ flex: 1 }} onPress={toLobby} />
            <AppButton testID="back-home" title="Home" variant="ghost" icon={<Home size={16} color={c.textSecondary} />} onPress={goHome} />
          </View>
        </>
      }
    >
      <View style={styles.head}>
        <Text style={[type.smallStrong, { color: tone }]}>Ranked Match Complete</Text>
        <Text testID="result-title" accessibilityRole="header" style={[type.title, { color: c.text }]}>{r.title}</Text>
        {r.reason ? <Text testID="result-reason" style={[type.small, { color: c.textSecondary }]}>{r.reason}</Text> : null}
        {r.outcome !== 'VOID' ? (
          <Text testID="result-points" style={[type.num, { color: tone }]}>
            {r.points >= 0 ? '+' : ''}{r.points} points
          </Text>
        ) : null}
        {rematch.requestedByOpponent && !rematch.requestedByMe ? (
          <Text testID="rematch-banner" style={[type.smallStrong, { color: c.accent }]}>{oppName} wants a rematch!</Text>
        ) : null}
        {rematch.requestedByMe ? <Text style={[type.small, { color: c.textSecondary }]}>Rematch request sent. Waiting for {oppName}...</Text> : null}
      </View>

      <View style={styles.players}>
        <View style={styles.side}>
          <AppAvatar avatarId={authMe?.avatar} name={authMe?.displayName} size="lg" activeRing={r.outcome === 'WIN'} />
          <Text numberOfLines={1} style={[type.smallStrong, { color: c.text, maxWidth: 110 }]}>{authMe?.displayName ?? 'You'}</Text>
          <Text style={[type.caption, { color: c.textSecondary }]}>{myPlayer?.mark ?? ''}</Text>
        </View>
        <Text style={[type.subheading, { color: c.textSecondary }]}>VS</Text>
        <View style={styles.side}>
          <AppAvatar avatarId={opponentCard?.avatar} name={oppName} size="lg" activeRing={r.outcome === 'LOSS'} />
          <Text numberOfLines={1} style={[type.smallStrong, { color: c.text, maxWidth: 110 }]}>{oppName}</Text>
          <Text style={[type.caption, { color: c.textSecondary }]}>{myPlayer ? (myPlayer.mark === 'X' ? 'O' : 'X') : ''}</Text>
        </View>
      </View>

      <GameBoard board={shown.board} size={shown.boardSize} winningLine={shown.result?.line ?? null} compact disabled maxSize={240} />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <ScoreCard label="Points" value={stats ? stats.points.toLocaleString() : '-'} subtext={r.outcome === 'VOID' ? undefined : `${r.points >= 0 ? '+' : ''}${r.points}`} tone={r.points >= 0 ? 'success' : 'warning'} />
        </View>
        <View style={{ flex: 1 }}>
          <ScoreCard label="Level" value={stats?.level ?? '-'} subtext={progress !== null ? `${progress}% to next` : undefined} tone="accent" />
        </View>
        <View style={{ flex: 1 }}>
          <ScoreCard label="XP" value={stats ? stats.xp.toLocaleString() : '-'} tone="warning" />
        </View>
      </View>

      <AppButton testID="replay-toggle" title={showReplay ? 'Hide Replay' : 'Watch Replay'} variant="secondary" fullWidth icon={<Film size={16} color={c.text} />} onPress={() => { setShowReplay((v) => !v); setStep(0); }} />
      {showReplay ? (
        <AppCard testID="replay-panel">
          {replay.isLoading ? (
            <AppLoader label="Loading replay..." />
          ) : replay.isError ? (
            <ErrorState offline={isOfflineError(replay.error)} message={friendlyMessage(replay.error)} onRetry={() => void replay.refetch()} />
          ) : (
            <View style={{ gap: 10 }}>
              <GameBoard board={frameBoard} size={shown.boardSize} compact disabled maxSize={240} lastMoveIndex={step > 0 ? frames[step - 1]?.position ?? null : null} />
              <View style={styles.stepper}>
                <AppButton testID="replay-prev" title="Prev" variant="outline" size="md" icon={<ChevronLeft size={16} color={c.text} />} disabled={step === 0} onPress={() => setStep((s) => Math.max(0, s - 1))} />
                <Text testID="replay-step" style={[type.num, { color: c.text }]}>{step}/{frames.length}</Text>
                <AppButton testID="replay-next" title="Next" variant="outline" size="md" icon={<ChevronRight size={16} color={c.text} />} disabled={step >= frames.length} onPress={() => setStep((s) => Math.min(frames.length, s + 1))} />
              </View>
            </View>
          )}
        </AppCard>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 6, paddingTop: 4 },
  players: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  side: { alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
