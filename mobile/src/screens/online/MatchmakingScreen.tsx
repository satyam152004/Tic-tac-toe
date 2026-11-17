import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { type } from '../../design-system/typography';
import { formatClock, useOnlineGame } from '../../hooks/useOnlineGame';
import { useBackGuard } from '../../hooks/useBackGuard';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { gameApi } from '../../services/api/gameApi';
import { cancelQuickMatch, startQuickMatch } from '../../services/onlineActions';
import { useOnlineStore } from '../../store/onlineStore';
import { isOfflineError } from './shared';

const FOUND_DELAY_MS = 1600;

export const MatchmakingScreen: React.FC<RootScreenProps<'matchmaking'>> = ({ route }) => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const boardSize = route.params.boardSize;
  const phase = useOnlineStore((s) => s.matchmaking.phase);
  const startedAt = useOnlineStore((s) => s.matchmaking.startedAt);
  const cancelReason = useOnlineStore((s) => s.matchmaking.cancelReason);
  const { game, opponentCard, me } = useOnlineGame();

  const [begun, setBegun] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(false);
  const mounted = useRef(false);
  const guard = useBackGuard({
    when: phase === 'searching',
    title: 'Cancel search?',
    message: 'You will leave the matchmaking queue.',
    confirmLabel: 'Cancel search',
    onLeave: () => void cancelQuickMatch(),
  });

  const begin = useCallback(() => {
    setError(null);
    startedRef.current = true;
    setBegun(true);
    startQuickMatch(boardSize).catch((e) => setError(e));
  }, [boardSize]);

  // Start once (guards StrictMode double effects / re-renders); leave the queue if we unmount still searching.
  useEffect(() => {
    mounted.current = true;
    if (!startedRef.current) begin();
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (!mounted.current && useOnlineStore.getState().matchmaking.phase === 'searching') void cancelQuickMatch();
      }, 50);
    };
  }, [begin]);

  useEffect(() => {
    if (phase !== 'searching' || !startedAt) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, startedAt]);

  const gameId = begun && phase === 'found' ? game?.id : undefined;
  useEffect(() => {
    if (!gameId) return;
    const t = setTimeout(() => {
      guard.allow();
      nav.replace('online_board', { gameId });
    }, FOUND_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, nav]);

  const cancel = async () => {
    guard.allow();
    await cancelQuickMatch();
    back();
  };

  const returnToGame = async () => {
    try {
      const active = (await gameApi.active()).find((g) => g.status === 'IN_PROGRESS' || g.status === 'READY' || g.status === 'WAITING');
      guard.allow();
      if (active) nav.replace('online_board', { gameId: active.id });
      else back();
    } catch (e) {
      setError(e);
    }
  };

  const retry = () => {
    useOnlineStore.getState().setMatchmaking({ cancelReason: null });
    begin();
  };

  let body: React.ReactNode;
  if (error) {
    const code = toApiError(error).code;
    body =
      code === 'ALREADY_IN_GAME' ? (
        <ErrorState title="You are already in a game" message={friendlyMessage(error)} retryLabel="Return to game" onRetry={returnToGame} />
      ) : (
        <ErrorState offline={isOfflineError(error)} message={friendlyMessage(error)} onRetry={retry} />
      );
  } else if (begun && phase === 'idle' && cancelReason === 'EXPIRED') {
    body = <ErrorState title="No opponent found" message="The search timed out. Try again or pick another board size." retryLabel="Search Again" onRetry={retry} />;
  } else {
    const found = phase === 'found';
    const oppName = opponentCard?.displayName ?? 'Opponent';
    body = (
      <>
        <View style={styles.top}>
          <Text style={[type.smallStrong, { color: c.textSecondary }]}>
            Ranked Arena · {boardSize}x{boardSize}
          </Text>
          <Text testID="search-timer" style={{ fontFamily: 'JetBrainsMono_700Bold', fontSize: 24, color: c.accent }}>
            {formatClock(elapsed)}
          </Text>
        </View>

        <View style={styles.vs}>
          <View style={styles.side}>
            <AppAvatar avatarId={me?.avatar} name={me?.displayName} size="lg" activeRing />
            <Text numberOfLines={1} style={[type.smallStrong, { color: c.text, maxWidth: 110 }]}>{me?.displayName ?? 'You'}</Text>
          </View>
          <Text style={[type.subheading, { color: c.textSecondary }]}>VS</Text>
          <View style={styles.side} testID="opponent-slot">
            {found ? (
              <AppAvatar avatarId={opponentCard?.avatar} name={oppName} size="lg" activeRing />
            ) : (
              <View style={[styles.unknown, { borderColor: c.accent }]}>
                <Text style={[type.heading, { color: c.accent }]}>?</Text>
              </View>
            )}
            <Text numberOfLines={1} style={[type.smallStrong, { color: found ? c.text : c.textSecondary, maxWidth: 110 }]}>{found ? oppName : 'Searching'}</Text>
            {found && opponentCard ? <Text style={[type.caption, { color: c.textSecondary }]}>Level {opponentCard.level}</Text> : null}
          </View>
        </View>

        {found ? (
          <AppLoader label="Opponent found!" sublabel="Entering the match..." />
        ) : (
          <AppLoader label="Searching for Opponent" sublabel={`In queue for ${elapsed}s · matching ${boardSize}x${boardSize} players`} />
        )}

        <AppButton testID="cancel-search" title="Cancel Search" variant="outline" fullWidth disabled={found} onPress={cancel} />
      </>
    );
  }

  return (
    <Screen title="Matchmaking" onBack={() => (phase === 'searching' ? void cancel() : back())}>
      {body}
    </Screen>
  );
};

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: 4, paddingTop: 8 },
  vs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 12 },
  side: { alignItems: 'center', gap: 8 },
  unknown: { width: 56, height: 56, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
