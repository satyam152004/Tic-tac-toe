import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../components/game/ActionButton';
import { Screen } from '../../components/common/Screen';
import { ErrorState } from '../../components/feedback/StateViews';
import { withAlpha } from '../../design-system/colors';
import { fonts, type } from '../../design-system/typography';
import { formatClock, useOnlineGame } from '../../hooks/useOnlineGame';
import { useBackGuard } from '../../hooks/useBackGuard';
import { ConfirmDialog } from '../../components/common/AppModal';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { gameApi } from '../../services/api/gameApi';
import { cancelQuickMatch, startQuickMatch } from '../../services/onlineActions';
import { useOnlineStore } from '../../store/onlineStore';
import { isOfflineError } from './shared';
import { isPreStart, matchFoundSource } from '../../services/gameRoute';

import { fs, ms } from '../../design-system/responsive';

const initialsOf = (name?: string | null): string =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || 'P';

export const MatchmakingScreen: React.FC<RootScreenProps<'matchmaking'>> = ({ route }) => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const boardSize = route.params.boardSize;
  const firstMove = route.params.firstMove;
  const entryAmount = route.params.entryAmount ?? 0;
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
    startQuickMatch(boardSize, firstMove, entryAmount).catch((e) => setError(e));
  }, [boardSize, firstMove, entryAmount]);

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
  // Found: the Match found screen takes over (it counts down before the board opens).
  useEffect(() => {
    if (!gameId) return;
    guard.allow();
    nav.replace('match_found', { gameId, source: 'RANKED' });
  }, [gameId, nav, guard]);

  // Outer ring pulses while searching (native driver, so it stays smooth during the match search).
  const pulse = useRef(new Animated.Value(0)).current;
  const found = phase === 'found';
  useEffect(() => {
    if (found) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [found, pulse]);
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.3] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  const cancel = async () => {
    guard.allow();
    await cancelQuickMatch();
    back();
  };

  const returnToGame = async () => {
    try {
      const active = (await gameApi.active()).find((g) => g.status === 'IN_PROGRESS' || g.status === 'READY' || g.status === 'WAITING');
      guard.allow();
      if (active && isPreStart(active)) nav.replace('match_found', { gameId: active.id, source: matchFoundSource(active.type) });
      else if (active) nav.replace('online_board', { gameId: active.id });
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
      <Screen title="Finding match" onBack={back}>
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
      <Screen title="Finding match" onBack={back}>
        <ErrorState title="No opponent found" message="No one was found. Try again or pick another board size." retryLabel="Search Again" onRetry={retry} />
      </Screen>
    );
  }

  const oppName = opponentCard?.displayName ?? 'Opponent';
  const myName = me?.displayName ?? 'You';
  const points = (me?.stats?.points ?? 0).toLocaleString();

  return (
    <>
      <Screen
        testID="matchmaking"
        footer={<ActionButton testID="cancel-search" title="Cancel search" variant="danger" fullWidth onPress={cancel} />}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>{found ? 'Opponent found' : 'Finding match'}</Text>
          <Text testID="search-spec" style={[styles.subtitle, { color: c.textSecondary }]}>
            {`Ranked, ${boardSize}×${boardSize}`}
          </Text>
        </View>

        {/* Radar: an animated outer ring, two static rings and the player's avatar in the centre. */}
        <View style={styles.radarWrap}>
          {!found ? (
            <Animated.View
              style={[styles.ring, styles.ringOuter, { borderColor: withAlpha(c.accent, 0.35), opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
            />
          ) : null}
          <View style={[styles.ring, styles.ringOuter, { borderColor: withAlpha(c.accent, 0.2) }]} />
          <View style={[styles.ring, styles.ringMid, { borderColor: withAlpha(c.accent, 0.4) }]} />
          <View style={[styles.avatar, { backgroundColor: c.accent, borderColor: withAlpha(c.accent, 0.5) }]}>
            <Text style={[styles.avatarText, { color: c.onAccent }]}>{initialsOf(myName)}</Text>
          </View>
        </View>

        <View style={styles.statusBlock}>
          <Text style={[styles.statusTitle, { color: c.text }]}>{found ? `Matched with ${oppName}` : 'Searching for an opponent'}</Text>
          <Text style={[styles.statusSub, { color: c.textSecondary }]}>
            {found ? 'Starting the match...' : 'Matching you with a player near your rank'}
          </Text>
          {!found ? (
            <Text testID="search-timer" style={[styles.timer, { color: c.text }]}>
              {formatClock(elapsed)}
            </Text>
          ) : null}
        </View>

        {/* Players: you on the left, the opponent (or "Searching") on the right. */}
        <View style={[styles.playersCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={styles.player}>
            <View style={[styles.smallAvatar, { backgroundColor: c.accent }]}>
              <Text style={[styles.smallAvatarText, { color: c.onAccent }]}>{initialsOf(myName)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>
                {myName}
              </Text>
              <Text numberOfLines={1} style={[type.small, { color: c.textSecondary }]}>
                {`Rating ${points}`}
              </Text>
            </View>
          </View>

          <Text style={[type.small, { color: c.textSecondary }]}>VS</Text>

          <View style={[styles.player, styles.playerRight]}>
            {found ? (
              <>
                <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
                  <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>
                    {oppName}
                  </Text>
                </View>
                <View style={[styles.smallAvatar, { backgroundColor: c.accentSecondary }]}>
                  <Text style={[styles.smallAvatarText, { color: c.onAccent }]}>{initialsOf(oppName)}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
                  <Text style={[type.bodyStrong, { color: c.text }]}>Searching</Text>
                  <Text style={[type.small, { color: c.textSecondary }]}>...</Text>
                </View>
                <View style={[styles.smallAvatar, styles.unknown, { backgroundColor: c.bgElevated }]}>
                  <Text style={[styles.unknownText, { color: c.textSecondary }]}>?</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Screen>
      <ConfirmDialog {...guard.dialog} />
    </>
  );
};

const RADAR = ms(220);
const AVATAR = ms(92);

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: ms(4), paddingTop: ms(8) },
  title: { ...type.title, },
  subtitle: { ...type.small, },
  radarWrap: { height: RADAR, alignItems: 'center', justifyContent: 'center', marginTop: ms(8) },
  ring: { position: 'absolute', borderWidth: 1.5, borderRadius: 999 },
  ringOuter: { width: RADAR, height: RADAR },
  ringMid: { width: ms(160), height: ms(160) },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
  },
  avatarText: { ...type.display, },
  statusBlock: { alignItems: 'center', gap: ms(6), marginTop: ms(4) },
  statusTitle: { ...type.heading, },
  statusSub: { ...type.small, textAlign: 'center' },
  timer: { ...type.numHero, marginTop: ms(8), letterSpacing: 1 },
  playersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    padding: ms(12),
    borderRadius: 16,
    borderWidth: 1,
    marginTop: ms(16),
  },
  player: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: ms(10) },
  playerRight: { justifyContent: 'flex-end' },
  smallAvatar: { width: ms(40), height: ms(40), borderRadius: ms(20), alignItems: 'center', justifyContent: 'center' },
  smallAvatarText: { ...type.labelStrong, },
  unknown: { borderWidth: 0 },
  unknownText: { ...type.heading, },
});
