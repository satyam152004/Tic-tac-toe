import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Screen } from '../../components/common/Screen';
import { ActionButton } from '../../components/game/ActionButton';
import { SymbolMark } from '../../components/game/SymbolMark';
import { withAlpha } from '../../design-system/colors';
import { fs, ms } from '../../design-system/responsive';
import { fonts, type } from '../../design-system/typography';
import { useMe } from '../../hooks/queries';
import { useOnlineGame } from '../../hooks/useOnlineGame';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import { gameApi } from '../../services/api/gameApi';
import { forfeitGame, openGame } from '../../services/onlineActions';
import { useLocalGameStore } from '../../store/localGameStore';
import { toast } from '../../store/toastStore';

const COUNTDOWN_FROM = 3;

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || 'P';

/**
 * "Match found" screen for every match type that starts with a countdown.
 *  - Online (ranked, friend challenge, private room): waits for the friend to accept if needed, then counts down
 *    and opens the online board.
 *  - Offline (computer, Pass n play): shown straight away with the setup you chose, then counts down and starts
 *    the local game on the offline board.
 */
export const MatchFoundScreen: React.FC<RootScreenProps<'match_found'>> = ({ route }) => {
  const params = route.params;
  const source = params.source;
  const local = source === 'COMPUTER' || source === 'PASS_N_PLAY';
  const isComputer = source === 'COMPUTER';
  const gameId = 'gameId' in params ? params.gameId : null;
  const opponentNameParam = 'opponentName' in params ? params.opponentName : undefined;

  const c = useTheme();
  const { nav, back } = useAppNav();
  const me = useMe();
  const { game, opponentCard, myMark } = useOnlineGame();
  const setup = useLocalGameStore((s) => s.setup);
  const [count, setCount] = useState(COUNTDOWN_FROM);
  const [leaving, setLeaving] = useState(false);

  // Load the online game if this screen was opened without it in the store (for example after a reconnect).
  useEffect(() => {
    if (gameId && game?.id !== gameId) void openGame(gameId).catch(() => undefined);
  }, [gameId, game?.id]);

  const ready = local || (game?.id === gameId && (game.status === 'READY' || game.status === 'IN_PROGRESS'));
  const waiting = !ready;

  useEffect(() => {
    if (!ready) return;
    if (count === 0) {
      if (local) {
        useLocalGameStore.getState().start();
        nav.replace('offline_board');
      } else {
        nav.replace('online_board', { gameId: gameId ?? '' });
      }
      return;
    }
    const t = setTimeout(() => setCount((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [ready, count, gameId, local, nav]);

  const myName = me.data?.displayName ?? 'You';
  const myLevel = me.data?.stats?.level ?? 1;

  // Left side is you (or Player 1 in Pass n play); right side is the opponent.
  const leftMark: 'X' | 'O' = local ? setup.p1Mark : (myMark ?? 'X');
  const rightMark: 'X' | 'O' = leftMark === 'X' ? 'O' : 'X';
  const leftName = local && !isComputer ? setup.p1Name : myName;
  const rightName = local ? (isComputer ? 'Computer' : setup.p2Name) : (opponentCard?.displayName ?? opponentNameParam ?? 'Opponent');
  const leftSub = local && !isComputer ? 'Player 1' : `Level ${myLevel}`;
  const rightSub = local ? (isComputer ? 'Bot' : 'Player 2') : opponentCard ? `Level ${opponentCard.level}` : '';
  const size = local ? setup.size : (game?.boardSize ?? 3);
  const entry = local ? 0 : (game?.entryAmount ?? 0);
  const firstMoverLabel = local
    ? `${leftMark === 'X' ? leftName : rightName} (X)`
    : leftMark === 'X'
      ? 'You (X)'
      : `${rightName} (X)`;

  const leave = async () => {
    if (leaving) return;
    if (local) {
      back();
      return;
    }
    if (!gameId) return;
    setLeaving(true);
    try {
      // A friend challenge that nobody has accepted yet is cancelled; anything else is a forfeit.
      if (source === 'FRIEND' && waiting) await gameApi.cancelInvite(gameId);
      else await forfeitGame(gameId);
      nav.replace('online_lobby');
    } catch (e) {
      setLeaving(false);
      toast.error("Couldn't leave the match", friendlyMessage(e));
    }
  };

  const modeValue = local
    ? isComputer
      ? 'Computer'
      : 'Pass n play'
    : source === 'RANKED'
      ? 'Ranked'
      : source === 'ROOM'
        ? 'Private room'
        : 'Friend challenge';
  const rewardValue = local
    ? 'Practice game'
    : entry > 0
      ? `${entry * 2} coins`
      : source === 'RANKED'
        ? 'Rating points'
        : source === 'ROOM'
          ? 'Friendly match'
          : 'Half rating points';

  const rows: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Mode', value: modeValue },
    { label: 'Board', value: `${size}×${size}` },
    { label: 'First move', value: firstMoverLabel },
    { label: 'Entry', value: entry > 0 ? `${entry} coins` : 'Free' },
    { label: 'Win reward', value: rewardValue, accent: true },
  ];

  return (
    <Screen
      testID="match-found"
      footer={
        <ActionButton
          testID="match-found-leave"
          title={local ? 'Cancel' : 'Leave match'}
          variant="secondary"
          fullWidth
          loading={leaving}
          onPress={leave}
        />
      }
    >
      <View style={styles.hero}>
        <View style={[styles.check, { backgroundColor: withAlpha(c.success, 0.15) }]}>
          <Check size={ms(36)} color={c.success} />
        </View>
        <Text testID="match-found-title" style={[type.displaySmall, styles.center, { color: c.text }]}>
          {waiting ? 'Waiting for friend' : 'Match found!'}
        </Text>
        <Text style={[type.bodySmall, styles.center, { color: c.textSecondary }]}>
          {waiting ? `Your challenge was sent to ${rightName}` : 'Get ready to play'}
        </Text>
      </View>

      <View style={styles.versus}>
        <PlayerTile name={leftName} sub={leftSub} mark={leftMark} avatarColor={c.accent} textColor={c.onAccent} />
        <Text style={[type.small, { color: c.textSecondary }]}>VS</Text>
        {waiting ? (
          <View testID="match-found-empty-slot" style={[styles.emptySlot, { borderColor: c.border, backgroundColor: c.bgCard }]}>
            <Text style={[type.small, styles.center, { color: c.textSecondary }]}>{`Waiting for ${rightName} to accept`}</Text>
          </View>
        ) : (
          <PlayerTile
            name={rightName}
            sub={rightSub}
            mark={rightMark}
            avatarColor={c.accentSecondary}
            textColor={c.onAccent}
            highlight={{ bg: withAlpha(c.accentSecondary, 0.14), text: c.accentSecondary }}
          />
        )}
      </View>

      <View style={[styles.details, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.row, i > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : null]}>
            <Text style={[type.body, { color: c.textSecondary }]}>{r.label}</Text>
            <Text style={[type.bodyStrong, { color: r.accent ? c.warning : c.text }]}>{r.value}</Text>
          </View>
        ))}
      </View>

      {waiting ? (
        <Text style={[type.small, styles.center, { color: c.textSecondary }]}>{`The match starts when ${rightName} accepts.`}</Text>
      ) : (
        <View style={styles.countWrap}>
          <Text style={[type.small, { color: c.textSecondary }]}>Game starts in</Text>
          <View style={[styles.countCircle, { borderColor: c.accent }]}>
            <Text testID="match-found-countdown" style={[styles.countText, { color: c.text }]}>
              {count}
            </Text>
          </View>
        </View>
      )}
    </Screen>
  );
};

const PlayerTile: React.FC<{
  name: string;
  sub: string;
  mark: 'X' | 'O';
  avatarColor: string;
  textColor: string;
  highlight?: { bg: string; text: string };
}> = ({ name, sub, mark, avatarColor, textColor, highlight }) => {
  const c = useTheme();
  return (
    <View style={[styles.tile, highlight ? { backgroundColor: highlight.bg } : null]}>
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={[styles.avatarText, { color: textColor }]}>{initialsOf(name)}</Text>
      </View>
      <Text numberOfLines={1} style={[type.bodyStrong, styles.center, { color: highlight?.text ?? c.text }]}>
        {name}
      </Text>
      <Text style={[type.small, styles.center, { color: highlight?.text ?? c.textSecondary }]}>{sub}</Text>
      <SymbolMark value={mark} size="sm" animate={false} />
    </View>
  );
};

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  hero: { alignItems: 'center', gap: ms(6), paddingTop: ms(8) },
  check: { width: ms(76), height: ms(76), borderRadius: ms(38), alignItems: 'center', justifyContent: 'center' },
  versus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ms(8), marginTop: ms(12) },
  tile: { flex: 1, alignItems: 'center', gap: ms(4), paddingVertical: ms(12), borderRadius: 16 },
  avatar: { width: ms(64), height: ms(64), borderRadius: ms(32), alignItems: 'center', justifyContent: 'center', marginBottom: ms(4) },
  avatarText: { ...type.heading, },
  emptySlot: {
    flex: 1,
    minHeight: ms(150),
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: ms(12),
  },
  details: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginTop: ms(12) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: ms(14), paddingVertical: ms(12) },
  countWrap: { alignItems: 'center', gap: ms(8), marginTop: ms(16) },
  countCircle: { width: ms(104), height: ms(104), borderRadius: ms(52), borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  countText: { ...type.numHero, },
});
