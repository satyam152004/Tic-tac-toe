import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { GameBoard } from '../../components/game/GameBoard';
import { fonts } from '../../design-system/typography';
import { usePublicProfile } from '../../hooks/queries';
import { formatClock, turnDeadlineMs, useCountdown } from '../../hooks/useOnlineGame';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage } from '../../services/api/errors';
import type { CheerKind, Game, PlayerCard, SpectateSnapshot } from '../../services/api/types';
import { gameSocket } from '../../services/socket/gameSocket';
import { socketClient } from '../../services/socket/socketClient';
import { toast } from '../../store/toastStore';

type Cards = SpectateSnapshot['players'];

const CHEERS: Array<{ kind: CheerKind; emoji: string; label: string }> = [
  { kind: 'clap', emoji: '👏', label: 'applause' },
  { kind: 'fire', emoji: '🔥', label: 'fire' },
  { kind: 'wow', emoji: '😮', label: 'wow' },
];

const initials = (name: string) => name.slice(0, 2).toUpperCase();

/** Read-only live view of a friend's online game (server `game:spectate`). */
export const SpectateMatchScreen: React.FC<RootScreenProps<'spectate_match'>> = ({ route }) => {
  const { gameId, friendName } = route.params;
  const c = useTheme();
  const { back } = useAppNav();
  const [game, setGame] = useState<Game | null>(null);
  const [cards, setCards] = useState<Cards>([]);
  const [viewers, setViewers] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [cheers, setCheers] = useState<Record<CheerKind, number>>({ clap: 0, fire: 0, wow: 0 });
  const receivedAt = useRef(Date.now());

  const apply = useCallback((g: Game) => {
    receivedAt.current = Date.now();
    setGame(g);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      await socketClient.whenReady();
      const snap = await gameSocket.spectate(gameId);
      setCards(snap.players);
      setViewers(snap.spectators);
      apply(snap.game);
    } catch (e) {
      setError(e);
    }
  }, [gameId, apply]);

  useEffect(() => {
    void load();
    const offs = [
      socketClient.on('game:updated', (p) => p.game.id === gameId && apply(p.game)),
      socketClient.on('game:finished', (p) => p.game.id === gameId && apply(p.game)),
      socketClient.on('game:draw', (p) => p.game.id === gameId && apply(p.game)),
      socketClient.on('game:spectators', (p) => p.gameId === gameId && setViewers(p.count)),
      socketClient.on('game:cheer', (p) => p.gameId === gameId && setCheers((prev) => ({ ...prev, [p.kind]: prev[p.kind] + 1 }))),
      // After a reconnect the server forgot our spectate channel: join again.
      socketClient.on('session:ready', () => void load()),
    ];
    return () => {
      offs.forEach((off) => off());
      gameSocket.unspectate(gameId).catch(() => undefined);
    };
  }, [gameId, apply, load]);

  const live = game?.status === 'IN_PROGRESS';
  const secondsLeft = useCountdown(turnDeadlineMs(game, receivedAt.current));

  const cardOf = (mark: 'X' | 'O') => cards.find((p) => p.mark === mark);
  const turnMark = game?.currentTurn ?? 'X';
  const idleMark = turnMark === 'X' ? 'O' : 'X';
  const mover = cardOf(turnMark);
  const waiter = cardOf(idleMark);
  const moverProfile = usePublicProfile(mover?.user?.id ?? '');
  const waiterProfile = usePublicProfile(waiter?.user?.id ?? '');

  const nameOf = (p: Cards[number] | undefined, fallback: string) => p?.user?.displayName ?? (p?.isAI ? 'AI' : fallback);
  const total = game ? game.boardSize * game.boardSize : 9;
  const pct = game ? Math.min(100, Math.round((game.moveCount / total) * 100)) : 0;

  const cheer = async (kind: CheerKind) => {
    try {
      await gameSocket.cheer(gameId, kind);
    } catch (e) {
      toast.error('Could not send reaction', friendlyMessage(e));
    }
  };

  const chip = (card: PlayerCard | null | undefined, bg: string) => (
    <View style={[styles.avatar, { backgroundColor: bg }]}>
      <Text style={styles.avatarText}>{initials(card?.displayName ?? '?')}</Text>
    </View>
  );

  if (error || !game) {
    return (
      <Screen title="Live Spectate" onBack={back} testID="spectate-match-screen">
        {error ? <ErrorState message={friendlyMessage(error)} onRetry={() => void load()} /> : <AppLoader label={`Joining ${friendName ?? 'match'}...`} />}
      </Screen>
    );
  }

  const ended = !live;
  return (
    <Screen
      title="Live Spectate"
      onBack={back}
      testID="spectate-match-screen"
      scroll={false}
      padded={false}
      rightAction={
        <View style={[styles.liveBadge, ended && { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
          <Text style={[styles.liveBadgeText, ended && { color: c.textSecondary }]}>{ended ? 'ENDED' : `LIVE • ${viewers}`}</Text>
        </View>
      }
      footer={
        <View style={styles.footer}>
          <AppButton testID="spectate-leave" title="Leave Spectate" variant="secondary" fullWidth onPress={back} />
        </View>
      }
    >
      <View style={styles.content}>
        <View style={[styles.track, { backgroundColor: c.bgSecondary }]}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: c.accent }]} />
        </View>

        <View style={[styles.playerCard, { backgroundColor: c.bgCard, borderColor: c.accent }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {chip(mover?.user, c.accent)}
            <View>
              <Text style={[styles.name, { color: c.text }]}>
                {nameOf(mover, friendName ?? 'Player')} ({turnMark}){ended ? '' : ' • Thinking'}
              </Text>
              <Text style={[styles.sub, { color: c.textSecondary }]}>
                {moverProfile.data ? `${moverProfile.data.stats.points.toLocaleString()} ELO • ` : ''}Move {Math.min(game.moveCount + (ended ? 0 : 1), total)} of {total}
              </Text>
            </View>
          </View>
          <Text style={styles.timer}>{secondsLeft !== null && !ended ? formatClock(secondsLeft) : '--:--'}</Text>
        </View>

        <View style={styles.boardWrap}>
          <GameBoard board={game.board} size={game.boardSize} winningLine={game.result?.line ?? null} disabled maxSize={260} />
        </View>

        <View style={[styles.playerCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {chip(waiter?.user, '#141518')}
            <Text style={[styles.name, { color: c.text }]}>
              {nameOf(waiter, 'Opponent')} ({idleMark})
            </Text>
          </View>
          {waiterProfile.data ? <Text style={[styles.sub, { color: c.textSecondary }]}>{waiterProfile.data.stats.points.toLocaleString()} ELO</Text> : null}
        </View>

        <View style={styles.cheersRow}>
          {CHEERS.map((ch) => (
            <Pressy
              key={ch.kind}
              testID={`cheer-${ch.kind}`}
              accessibilityLabel={`Send ${ch.label}`}
              onPress={() => void cheer(ch.kind)}
              style={[styles.cheerBtn, ch.kind === 'wow' ? { backgroundColor: '#EFF4FF', borderColor: c.accent } : { backgroundColor: c.bgCard, borderColor: c.border }]}
            >
              <Text style={[styles.cheerText, { color: ch.kind === 'wow' ? c.accent : c.text }]}>
                {ch.emoji} {cheers[ch.kind]}
              </Text>
            </Pressy>
          ))}
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  liveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  liveBadgeText: {
    fontSize: 10,
    fontFamily: fonts.mono.semibold,
    color: '#B91C1C',
  },
  track: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
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
    borderWidth: 1.5,
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
  name: {
    fontSize: 12,
    fontFamily: fonts.body.semibold,
  },
  sub: {
    fontSize: 10,
    fontFamily: fonts.mono.medium,
    marginTop: 1,
  },
  timer: {
    fontSize: 12,
    fontFamily: fonts.mono.semibold,
    color: '#1D4ED8',
  },
  boardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cheersRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cheerBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cheerText: {
    fontSize: 11.5,
    fontFamily: fonts.mono.semibold,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
});
