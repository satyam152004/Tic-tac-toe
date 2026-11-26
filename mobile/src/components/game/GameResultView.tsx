import { Frown, Handshake, Play, Trophy, UserPlus } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { withAlpha } from '../../design-system/colors';
import { radius } from '../../design-system/radius';
import { space } from '../../design-system/spacing';
import { type } from '../../design-system/typography';
import { ms } from '../../design-system/responsive';
import { useTheme } from '../../hooks/useTheme';
import type { BoardSize } from '../../services/api/types';
import { Screen } from '../common/Screen';
import { ActionButton } from './ActionButton';
import { GameBoard } from './GameBoard';

/**
 * THE game-over screen, used by every mode (Pass n play, vs Computer, online, friend rooms) after win, loss or draw.
 * Callers supply the words, seats, stats and buttons; the outcome picks the icon and theme colours here.
 */

export type ResultOutcome = 'win' | 'loss' | 'draw';

export interface ResultSeat {
  name: string;
  symbol: 'X' | 'O';
  /** Shown big under the name: a running score, or points gained/lost (e.g. "+12"). */
  scoreText: string;
  isWinner: boolean;
}

export interface ResultStat {
  label: string;
  value: string;
}

export interface GameResultViewProps {
  testID: string;
  outcome: ResultOutcome;
  headline: string;
  subtitle: string;
  seats: [ResultSeat, ResultSeat];
  board: ('X' | 'O' | '')[];
  boardSize: BoardSize;
  winningLine: number[] | null;
  stats: [ResultStat, ResultStat, ResultStat];
  onClose: () => void;
  primary: { testID: string; label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
  secondary: [{ testID: string; label: string; onPress: () => void }, { testID: string; label: string; onPress: () => void }];
  /** Small line under the stats, e.g. "Saved to match history". */
  note?: string;
  noteTestID?: string;
  /** Opens the match replay. Omit when there are no moves to replay. */
  replay?: { testID: string; onPress: () => void };
  /** Optional "Add friend" action, shown under the replay button. Omit when there is no one to add. */
  friend?: { testID: string; label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
}

type ThemeTones = ReturnType<typeof useTheme>;

/** Icon circle, icon and headline colours for each outcome, all from the active theme. */
function toneFor(c: ThemeTones, outcome: ResultOutcome) {
  if (outcome === 'win') return { bg: withAlpha(c.success, 0.14), fg: c.success, text: c.success, Icon: Trophy };
  if (outcome === 'loss') return { bg: c.dangerSoft, fg: c.danger, text: c.dangerText, Icon: Frown };
  return { bg: c.bgElevated, fg: c.accent, text: c.accent, Icon: Handshake };
}

const Seat: React.FC<{ seat: ResultSeat }> = ({ seat }) => {
  const c = useTheme();
  return (
    <View style={styles.seat}>
      <View style={[styles.avatar, { backgroundColor: seat.symbol === 'X' ? c.x : c.o }]}>
        <Text style={[type.labelStrong, { color: c.onAccent }]}>{seat.name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>
        {seat.name} ({seat.symbol})
      </Text>
      <Text style={[type.numLarge, { color: seat.isWinner ? c.success : c.textSecondary }]}>{seat.scoreText}</Text>
    </View>
  );
};

export const GameResultView: React.FC<GameResultViewProps> = (p) => {
  const c = useTheme();
  const tone = toneFor(c, p.outcome);
  const Icon = tone.Icon;

  return (
    <Screen
      testID={p.testID}
      title="Game over"
      onBack={p.onClose}
      padded={false}
      footer={
        <View style={styles.footer}>
          <ActionButton testID={p.primary.testID} title={p.primary.label} fullWidth loading={p.primary.loading} disabled={p.primary.disabled} onPress={p.primary.onPress} />
          <View style={styles.btnRow}>
            <ActionButton testID={p.secondary[0].testID} title={p.secondary[0].label} variant="secondary" compact style={styles.flex} onPress={p.secondary[0].onPress} />
            <ActionButton testID={p.secondary[1].testID} title={p.secondary[1].label} variant="secondary" compact style={styles.flex} onPress={p.secondary[1].onPress} />
          </View>
        </View>
      }
    >
      <View style={styles.content}>
        <View style={[styles.hero, { backgroundColor: tone.bg }]}>
          <Icon size={ms(40)} color={tone.fg} />
        </View>
        <Text testID="result-title" accessibilityRole="header" style={[type.displaySmall, styles.center, { color: tone.text }]}>
          {p.headline}
        </Text>
        <Text style={[type.bodySmall, styles.center, { color: c.textSecondary }]}>{p.subtitle}</Text>

        <View style={[styles.matchCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Seat seat={p.seats[0]} />
          <View style={styles.miniBoard}>
            <GameBoard board={p.board} size={p.boardSize} winningLine={p.winningLine} compact disabled maxSize={120} />
          </View>
          <Seat seat={p.seats[1]} />
        </View>

        <View style={styles.statsRow}>
          {p.stats.map((s) => (
            <View key={s.label} style={[styles.statTile, { backgroundColor: c.bgSecondary }]}>
              <Text style={[type.caption, { color: c.textSecondary }]}>{s.label}</Text>
              <Text style={[type.num, { color: c.text }]}>{s.value}</Text>
            </View>
          ))}
        </View>

        {p.replay ? (
          <ActionButton
            testID={p.replay.testID}
            title="Watch replay"
            variant="secondary"
            compact
            icon={<Play size={ms(16)} color={c.text} />}
            onPress={p.replay.onPress}
            style={styles.replayBtn}
          />
        ) : null}

        {p.friend ? (
          <ActionButton
            testID={p.friend.testID}
            title={p.friend.label}
            variant="secondary"
            compact
            icon={<UserPlus size={ms(16)} color={c.text} />}
            loading={p.friend.loading}
            disabled={p.friend.disabled}
            onPress={p.friend.onPress}
            style={styles.replayBtn}
          />
        ) : null}

        {p.note ? (
          <Text testID={p.noteTestID} style={[type.caption, { color: c.textSecondary }]}>
            {p.note}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg, alignItems: 'center', gap: space.md },
  center: { textAlign: 'center' },
  hero: { width: ms(88), height: ms(88), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  matchCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
  },
  seat: { flex: 1, minWidth: 0, alignItems: 'center', gap: space.xs },
  avatar: { width: ms(40), height: ms(40), borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  miniBoard: { width: ms(120), alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', width: '100%', gap: space.sm },
  statTile: { flex: 1, borderRadius: radius.md, paddingVertical: space.sm, alignItems: 'center', gap: space.xs },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, gap: space.sm },
  btnRow: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  replayBtn: { alignSelf: 'center', minWidth: ms(180) },
});
