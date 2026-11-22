import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
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
        <ErrorState title="No opponent found" message="The search timed out. Try again or pick another board size." retryLabel="Search Again" onRetry={retry} />
      </Screen>
    );
  }

  const found = phase === 'found';
  const oppName = opponentCard?.displayName ?? 'Opponent';

  return (
    <Screen
      title="Finding Opponent"
      onBack={cancel}
      footer={
        <AppButton
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
          {found ? 'Opponent Found!' : 'Searching Arena...'}
        </Text>

        <View style={styles.specPill}>
          <Text style={[styles.specText, { color: c.textSecondary }]}>
            {boardSize}×{boardSize} Ranked • ~1,500 ELO
          </Text>
        </View>

        {/* Player vs Opponent preview */}
        <View style={styles.vsRow}>
          <View style={styles.avatarCol}>
            <AppAvatar avatarId={me?.avatar} name={me?.displayName} size="md" activeRing />
            <Text numberOfLines={1} style={[styles.playerName, { color: c.text }]}>
              {me?.displayName ?? 'You'}
            </Text>
          </View>

          <Text style={[styles.vsText, { color: c.textSecondary }]}>VS</Text>

          <View style={styles.avatarCol} testID="opponent-slot">
            {found ? (
              <AppAvatar avatarId={opponentCard?.avatar} name={oppName} size="md" activeRing />
            ) : (
              <View style={[styles.unknownBox, { borderColor: c.border }]}>
                <Text style={[styles.unknownText, { color: c.textSecondary }]}>?</Text>
              </View>
            )}
            <Text numberOfLines={1} style={[styles.playerName, { color: found ? c.text : c.textSecondary }]}>
              {found ? oppName : 'Searching...'}
            </Text>
          </View>
        </View>

        {found ? (
          <View style={{ marginTop: 12 }}>
            <AppLoader label="Entering match..." />
          </View>
        ) : null}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  outerRadar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  midRadar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerTimerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    fontSize: 14,
    fontFamily: fonts.mono.semibold,
    color: '#1D4ED8',
  },
  title: {
    fontSize: 17,
    fontFamily: fonts.body.semibold,
    marginTop: 6,
  },
  specPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4DF',
  },
  specText: {
    fontSize: 11,
    fontFamily: fonts.body.medium,
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 16,
  },
  avatarCol: {
    alignItems: 'center',
    gap: 6,
    width: 80,
  },
  playerName: {
    fontSize: 11.5,
    fontFamily: fonts.body.semibold,
  },
  vsText: {
    fontSize: 13,
    fontFamily: fonts.mono.semibold,
  },
  unknownBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unknownText: {
    fontSize: 16,
    fontFamily: fonts.mono.semibold,
  },
});
