import { CommonActions } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { GameResultView, ResultOutcome, ResultSeat } from '../../components/game/GameResultView';
import { formatClock, useOnlineGame } from '../../hooks/useOnlineGame';
import { useAppNav } from '../../navigation/useAppNav';
import { friendApi } from '../../services/api/friendApi';
import { matchFoundSource } from '../../services/gameRoute';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import type { Game } from '../../services/api/types';
import { openGame, requestRematch } from '../../services/onlineActions';
import { localGameStorage, StoredMatch } from '../../services/storage/localGameStorage';
import { seatsOf, useLocalGameStore } from '../../store/localGameStore';
import { useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';
import { formatDurationMs } from '../../utils/format';
import { LocalReplayModal } from '../offline/OfflineHistoryScreen';
import { socialError } from '../social/socialShared';
import { isOfflineError } from '../online/shared';
import { ReplaySheet } from '../progression/ReplaySheet';

/**
 * THE game-over screen for every mode. The route decides the source:
 *  - no `gameId` param  -> the game just finished on this phone (Pass n play, vs Computer), from the local store.
 *  - `gameId` param     -> an online or friend-room match, from the server.
 * The layout is always GameResultView.
 */
export const GameResultScreen: React.FC<{ route: { params?: { gameId: string } } }> = ({ route }) => {
  const onlineId = route.params?.gameId ?? null;
  const isOnline = onlineId !== null;
  const { nav, goHome, goTab } = useAppNav();

  // Local games (Pass n play, vs Computer)
  const localGame = useLocalGameStore((s) => s.game);
  const setup = useLocalGameStore((s) => s.setup);
  const lastMatchId = useLocalGameStore((s) => s.lastMatchId);
  const [replayMatch, setReplayMatch] = useState<StoredMatch | null>(null);
  const localMissing = !isOnline && !localGame;
  useEffect(() => {
    if (localMissing) goHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMissing]);

  // Online games (ranked and friend rooms)
  const { game: onlineGame, me: authMe, opponentCard } = useOnlineGame();
  const rematch = useOnlineStore((s) => s.rematch);
  const rematchGameId = useOnlineStore((s) => s.rematchGameId);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [rematching, setRematching] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [friendState, setFriendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const last = useRef<Game | null>(null);
  if (isOnline && onlineGame && onlineGame.id === onlineId) last.current = onlineGame;
  const shown = isOnline ? last.current : null;

  useEffect(() => {
    if (!isOnline || onlineGame?.id === onlineId) return;
    openGame(onlineId).catch((e) => setLoadError(e));
  }, [isOnline, onlineId, onlineGame?.id]);

  useEffect(() => {
    if (isOnline && rematchGameId && rematchGameId !== onlineId) nav.replace('match_found', { gameId: rematchGameId, source: matchFoundSource(shown?.type) });
  }, [isOnline, rematchGameId, onlineId, nav]);

  const askRematch = async () => {
    if (!onlineId || rematching || rematch.requestedByMe) return;
    setRematching(true);
    try {
      await requestRematch(onlineId);
    } catch (e) {
      toast.error("Can't start a rematch", friendlyMessage(e));
    } finally {
      setRematching(false);
    }
  };

  const toLobby = () => nav.dispatch(CommonActions.reset({ index: 1, routes: [{ name: 'Main', params: { screen: 'HomeTab' } }, { name: 'online_lobby' }] }));

  const openReplay = async () => {
    if (!lastMatchId) return;
    const match = await localGameStorage.findByClientId(lastMatchId).catch(() => null);
    if (match) setReplayMatch(match);
    else toast.error("Can't open replay", "This match isn't saved on this phone.");
  };

  const goHomeAndQuit = () => {
    useLocalGameStore.getState().quit();
    goHome();
  };

  // ---- Online ----
  if (isOnline) {
    if (!shown) {
      return (
        <Screen title="Match Result" onBack={goHome}>
          {loadError ? <ErrorState offline={isOfflineError(loadError)} message={friendlyMessage(loadError)} onRetry={() => openGame(onlineId)} /> : <AppLoader label="Loading result..." />}
        </Screen>
      );
    }
    const myId = authMe?.id;
    const myPlayer = shown.players.find((p) => p.userId === myId);
    const oppPlayer = shown.players.find((p) => p.userId !== myId);
    const isWin = myPlayer?.outcome === 'WIN';
    const isLoss = myPlayer?.outcome === 'LOSS';
    const outcome: ResultOutcome = isWin ? 'win' : isLoss ? 'loss' : 'draw';
    const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;
    const myMark = myPlayer?.mark ?? 'X';
    const oppMark = oppPlayer?.mark ?? (myMark === 'X' ? 'O' : 'X');
    const totalMoves = shown.moveCount ?? shown.board.filter((x) => x !== '').length;
    const duration = shown.durationMs != null ? formatClock(Math.round(shown.durationMs / 1000)) : '--:--';
    // Ranked opponents are not friends yet; friend-room opponents already are, so the button is only for ranked matches.
    const opponentId = oppPlayer?.userId ?? null;
    const canAddFriend = shown.type === 'ONLINE_RANDOM' && !!opponentId && opponentId !== myId;
    const oppName = opponentCard?.displayName ?? 'Opponent';
    const addFriend = async () => {
      if (!opponentId || friendState !== 'idle') return;
      setFriendState('sending');
      try {
        await friendApi.request({ userId: opponentId });
        setFriendState('sent');
        toast.success('Friend request sent', `${oppName} will see it in their Friends tab.`);
      } catch (e) {
        const code = toApiError(e).code;
        if (code === 'ALREADY_FRIENDS') {
          setFriendState('sent');
          toast.info("You're already friends", oppName);
        } else if (code === 'REQUEST_ALREADY_SENT') {
          setFriendState('sent');
          toast.info('Request already sent', `Waiting for ${oppName} to respond`);
        } else {
          setFriendState('idle');
          toast.error("Couldn't send the request", socialError(e));
        }
      }
    };
    const seats: [ResultSeat, ResultSeat] = [
      { name: 'You', symbol: myMark, scoreText: signed(myPlayer?.pointsAwarded ?? 0), isWinner: isWin },
      { name: opponentCard?.displayName ?? 'Opponent', symbol: oppMark, scoreText: signed(oppPlayer?.pointsAwarded ?? 0), isWinner: isLoss },
    ];
    return (
      <>
        <GameResultView
          testID="online-result"
          outcome={outcome}
          headline={isWin ? 'You won!' : isLoss ? 'You lost' : "It's a draw"}
          subtitle={isWin ? `You made ${shown.winLength} in a row. Well played!` : isLoss ? 'Better luck next time.' : 'Nobody won this match.'}
          seats={seats}
          board={shown.board}
          boardSize={shown.boardSize}
          winningLine={shown.result?.line ?? null}
          stats={[
            { label: 'Moves', value: `${totalMoves}` },
            { label: 'Time', value: duration },
            { label: 'Board', value: `${shown.boardSize}×${shown.boardSize}` },
          ]}
          onClose={toLobby}
          primary={{
            testID: 'rematch',
            label: rematch.requestedByMe ? 'Waiting for opponent...' : rematch.requestedByOpponent ? 'Accept rematch' : 'Request rematch',
            loading: rematching,
            disabled: rematch.requestedByMe,
            onPress: askRematch,
          }}
          secondary={[
            { testID: 'back-lobby', label: 'Lobby', onPress: toLobby },
            { testID: 'result-home', label: 'Home', onPress: goHome },
          ]}
          replay={{ testID: 'result-replay', onPress: () => setReplayOpen(true) }}
          friend={
            canAddFriend
              ? {
                  testID: 'result-add-friend',
                  label: friendState === 'sent' ? 'Request sent' : 'Add friend',
                  loading: friendState === 'sending',
                  disabled: friendState === 'sent',
                  onPress: () => void addFriend(),
                }
              : undefined
          }
        />
        <ReplaySheet gameId={replayOpen ? onlineId : null} onClose={() => setReplayOpen(false)} />
      </>
    );
  }

  // ---- Local (Pass n play, vs Computer) ----
  if (!localGame) return null;
  const seats = seatsOf(setup);
  const out = localGame.outcome;
  const isDraw = out.status !== 'WIN';
  const winner = out.status === 'WIN' ? out.winner : null;
  const vsAi = localGame.mode === 'VS_AI';
  const humanWon = vsAi && winner === localGame.humanMark;
  const humanLost = vsAi && winner !== null && winner !== localGame.humanMark;
  const localOutcome: ResultOutcome = isDraw ? 'draw' : vsAi ? (humanWon ? 'win' : 'loss') : 'win';
  const seat = (mark: 'X' | 'O'): ResultSeat => ({
    name: seats[mark].name,
    symbol: mark,
    scoreText: `${localGame.scores[mark]}`,
    isWinner: winner === mark,
  });

  return (
    <>
      <GameResultView
        testID="game-result"
        outcome={localOutcome}
        headline={isDraw ? "It's a draw" : vsAi ? (humanWon ? 'You won!' : 'You lost') : `${seats[winner!].name} wins!`}
        subtitle={
          isDraw
            ? 'Nobody made a line this time.'
            : humanLost
              ? `The computer made ${localGame.config.winLength} in a row.`
              : `${seats[winner!].name} made ${localGame.config.winLength} in a row. Well played!`
        }
        seats={[seat('X'), seat('O')]}
        board={localGame.board}
        boardSize={localGame.config.size}
        winningLine={out.status === 'WIN' ? out.line : null}
        stats={[
          { label: 'Moves', value: `${localGame.moves.length}` },
          { label: 'Time', value: formatDurationMs(localGame.elapsedMs) },
          { label: 'Board', value: `${localGame.config.size}×${localGame.config.size}` },
        ]}
        onClose={goHomeAndQuit}
        primary={{ testID: 'result-rematch', label: 'Play again', onPress: () => nav.navigate('rematch') }}
        secondary={[
          { testID: 'result-settings', label: 'Change mode', onPress: () => goTab('HomeTab') },
          { testID: 'result-home', label: 'Home', onPress: goHomeAndQuit },
        ]}
        note={lastMatchId ? 'Saved to match history' : undefined}
        noteTestID="result-saved"
        replay={lastMatchId ? { testID: 'result-replay', onPress: () => void openReplay() } : undefined}
      />
      <LocalReplayModal match={replayMatch} onClose={() => setReplayMatch(null)} />
    </>
  );
};
