import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../components/game/ActionButton';
import { Screen } from '../../components/common/Screen';
import { ErrorState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
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

import { ch, fs, ms } from '../../design-system/responsive';
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
    message: 'You will stop looking for an opponent.',
    confirmLabel: 'Cancel search',
    onLeave: () => void cancelQuickMatch(),
  });

  const begin = useCallback(() => {
    setError(null);
    startedRef.current = true;
    setBegun(true);
    startQuickMatch(boardSize).catch((e) => setError(e));
  }, [boardSize]);

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
  }, [gameId, nav, guard]);

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

  if (error) {
    const code = toApiError(error).code;
    return (
      <Screen title="Finding Opponent" onBack={back}>
        {code === 'ALREADY_IN_GAME' ? (
          <ErrorState title="You are already in a game" message={friendlyMessage(error)} retryLabel="Return to game" onRetry={returnToGame} />
        ) : (
          <ErrorState offline={isOfflineError(error)} message={friendlyMessage(error)} onRetry={retry} />
        )}
      </Screen>
    );
  }

  if (begun && phase === 'idle' && cancelReason === 'EXPIRED') {
    return (
      <Screen title="Finding Opponent" onBack={back}>
        <ErrorState title="No opponent found" message="No one was found. Try again or pick another board size." retryLabel="Search Again" onRetry={retry} />
      </Screen>
    );
  }

  const found = phase === 'found';
  const oppName = opponentCard?.displayName ?? 'Opponent';

  return (
    <Screen
      title="Finding Opponent"
      testID="matchmaking"
      footer={
        <ActionButton
          testID="cancel-search"
          title="Cancel Search"
          variant="secondary"
          fullWidth
          onPress={cancel}
        />
      }
    >
      <View style={styles.centerContainer}>
        {/* Concentric radar rings matching prototype */}
        <View style={styles.outerRadar}>
          <View style={styles.midRadar}>
            <View style={styles.innerTimerBadge}>
              <Text testID="search-timer" style={styles.timerText}>
                {formatClock(elapsed)}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.title, { color: c.text }]}>
          {found ? 'Opponent Found!' : 'Looking for an opponent...'}
        </Text>

        <View style={styles.specPill}>
          <Text testID="search-spec" style={[styles.specText, { color: c.textSecondary }]}>
            {found ? `vs ${oppName}` : `${boardSize}×${boardSize} Ranked • Rating ${(me?.stats?.points ?? 0).toLocaleString()}`}
          </Text>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ms(20),
    gap: ms(8),
  },
  outerRadar: {
    width: ms(144),
    height: ms(144),
    borderRadius: ms(72),
    backgroundColor: 'rgba(239,244,255,0.55)',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  midRadar: {
    width: ms(96),
    height: ms(96),
    borderRadius: ms(48),
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerTimerBadge: {
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1D4ED8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  timerText: {
    fontSize: fs(14),
    fontFamily: fonts.mono.semibold,
    color: '#1D4ED8',
  },
  title: {
    fontSize: fs(17),
    fontFamily: fonts.body.semibold,
    marginTop: ms(12),
  },
  specPill: {
    paddingHorizontal: ms(12),
    paddingVertical: ms(4),
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4DF',
  },
  specText: {
    fontSize: fs(11),
    fontFamily: fonts.body.semibold,
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(20),
    marginTop: ms(16),
  },
  avatarCol: {
    alignItems: 'center',
    gap: ms(6),
    width: ms(80),
  },
  playerName: {
    fontSize: fs(11.5),
    fontFamily: fonts.body.semibold,
  },
  vsText: {
    fontSize: fs(13),
    fontFamily: fonts.mono.semibold,
  },
  unknownBox: {
    width: ms(44),
    height: ch(44),
    borderRadius: ms(22),
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unknownText: {
    fontSize: fs(16),
    fontFamily: fonts.mono.semibold,
  },
});
