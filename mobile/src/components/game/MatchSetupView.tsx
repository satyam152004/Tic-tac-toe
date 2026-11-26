import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Bot, Brain, Flame, Info, Meh, Shuffle, Smile, Zap, type LucideIcon } from 'lucide-react-native';
import { withAlpha } from '../../design-system/colors';
import { fs, ms } from '../../design-system/responsive';
import { fonts, type } from '../../design-system/typography';
import { BoardSize, Difficulty } from '../../game-engine';
import type { EntryAmount } from '../../services/api/types';
import { useTheme } from '../../hooks/useTheme';
import { ProtoInput } from '../../screens/auth/protoUi';
import { Pressy } from '../common/Pressy';
import { Screen } from '../common/Screen';
import { ActionButton } from './ActionButton';
import { SymbolMark } from './SymbolMark';

/**
 * Shared setup UI for the offline game flow. One file, two modes:
 *  - VS_AI   (computer):  Difficulty, Board size, You play as (+ Random), a hint, the coin pill.
 *  - LOCAL_2P (pass n play): Players (name inputs), Board size, Player 1 plays as (X / O), Who goes first.
 * Both modes end with the same "Match ready" sheet. The owning screen keeps the state and the start logic.
 */

export type MatchMode = 'VS_AI' | 'LOCAL_2P' | 'ONLINE';
export type Mark = 'X' | 'O';
export type MarkChoice = Mark | 'RANDOM';
export type FirstMove = 'p1' | 'p2' | 'random';

export const AI_LEVELS: { id: Difficulty; title: string; note: string }[] = [
  { id: 'EASY', title: 'Easy', note: 'Relaxed moves' },
  { id: 'MEDIUM', title: 'Medium', note: 'A fair challenge' },
  { id: 'HARD', title: 'Hard', note: 'Thinks a few moves ahead' },
  { id: 'EXPERT', title: 'Expert', note: 'Plans many moves ahead' },
  { id: 'IMPOSSIBLE', title: 'Unbeatable', note: 'Never loses' },
];

const LEVEL_ICON: Record<Difficulty, LucideIcon> = {
  EASY: Smile,
  MEDIUM: Meh,
  HARD: Zap,
  EXPERT: Brain,
  IMPOSSIBLE: Flame,
};

/** How strong each level is, shown as filled bars (1 = easiest). */
const STRENGTH: Record<Difficulty, number> = { EASY: 1, MEDIUM: 2, HARD: 3, EXPERT: 4, IMPOSSIBLE: 5 };

export const BOARD_OPTIONS: { size: BoardSize; label: string; sub: string }[] = [
  { size: 3, label: '3×3', sub: 'Classic' },
  { size: 4, label: '4×4', sub: 'Win with 4' },
  { size: 5, label: '5×5', sub: 'Win with 4' },
];

const AI_MARK_OPTIONS: { choice: MarkChoice; label: string }[] = [
  { choice: 'X', label: 'Goes first' },
  { choice: 'O', label: 'Goes second' },
  { choice: 'RANDOM', label: 'Random' },
];

const TWO_PLAYER_MARK_OPTIONS: { choice: Mark; label: string }[] = [
  { choice: 'X', label: 'Goes first' },
  { choice: 'O', label: 'Goes second' },
];

const TIMER_OPTIONS: { value: 0 | 15 | 30; label: string }[] = [
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 0, label: 'Off' },
];

const ENTRY_OPTIONS: { value: EntryAmount; label: string }[] = [
  { value: 0, label: 'Free' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
];

const FIRST_MOVE_OPTIONS: { id: FirstMove; label: string }[] = [
  { id: 'p1', label: 'Player 1' },
  { id: 'p2', label: 'Player 2' },
  { id: 'random', label: 'Random' },
];

/** One side of the "Match ready" sheet. */
export interface MatchSetupViewProps {
  mode: MatchMode;
  title: string;
  testID: string;
  onBack: () => void;
  footerTitle: string;
  footerTestID: string;
  onContinue: () => void;

  /** VS_AI only. */
  coins?: number;
  difficulty?: Difficulty;
  onDifficultyChange?: (d: Difficulty) => void;

  /** LOCAL_2P only. */
  p1Name?: string;
  onP1NameChange?: (v: string) => void;
  p2Name?: string;
  onP2NameChange?: (v: string) => void;
  nameErrors?: { p1?: string; p2?: string };
  firstMove?: string;
  onFirstMoveChange?: (f: string) => void;
  /** Who-goes-first choices. Defaults to the Pass n play labels (Player 1 / Player 2 / Random). */
  firstMoveOptions?: { id: string; label: string }[];
  /** Online only: coins each player pays to start (0 = free). Shown when the handler is given. */
  entryAmount?: EntryAmount;
  onEntryAmountChange?: (e: EntryAmount) => void;

  /** Both modes. */
  size: BoardSize;
  onSizeChange: (s: BoardSize) => void;
  markChoice?: MarkChoice;
  onMarkChoiceChange?: (m: MarkChoice) => void;

  /** Optional content above the sections. */
  topSlot?: React.ReactNode;
  /** Online room only: turn timer in seconds (0 = off). Shown when the handler is given. */
  turnTimer?: 0 | 15 | 30;
  onTurnTimerChange?: (t: 0 | 15 | 30) => void;
  /** Optional second footer button, shown under the main one. */
  footerSecondary?: { testID: string; title: string; onPress: () => void };

}

/** Small preview of a board size: a grid of squares. */
const MiniBoard: React.FC<{ size: BoardSize; color: string }> = ({ size, color }) => {
  const cell = size === 3 ? ms(10) : size === 4 ? ms(8) : ms(6.5);
  const gap = size === 3 ? ms(3) : ms(2.5);
  const width = size * cell + (size - 1) * gap;
  return (
    <View style={{ width, flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {Array.from({ length: size * size }).map((_, i) => (
        <View key={i} style={{ width: cell, height: cell, borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );
};

/** Selectable card with the shared selected border. */
const OptionCard: React.FC<{
  testID: string;
  a11yLabel: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}> = ({ testID, a11yLabel, selected, onPress, style, children }) => {
  const c = useTheme();
  return (
    <Pressy
      testID={testID}
      accessibilityLabel={`${a11yLabel}${selected ? ', selected' : ''}`}
      onPress={onPress}
      style={[styles.card, { backgroundColor: c.bgCard, borderColor: selected ? c.accent : c.border, borderWidth: selected ? 1.5 : 1 }, style]}
    >
      {children}
    </Pressy>
  );
};

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const c = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[type.caption, { color: c.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
};

const CoinPill: React.FC<{ coins: number }> = ({ coins }) => {
  const c = useTheme();
  return (
    <View
      testID="coin-balance"
      accessibilityLabel={`${coins} coins`}
      style={[styles.coinPill, { backgroundColor: withAlpha(c.warning, 0.15), borderColor: withAlpha(c.warning, 0.4) }]}
    >
      <Text style={[styles.coinText, { color: c.warning }]} numberOfLines={1}>
        {coins.toLocaleString()} Coins
      </Text>
    </View>
  );
};

export const MatchSetupView: React.FC<MatchSetupViewProps> = (p) => {
  const c = useTheme();
  const isAi = p.mode === 'VS_AI';
  const markOptions = isAi ? AI_MARK_OPTIONS : TWO_PLAYER_MARK_OPTIONS;

  return (
    <Screen
      title={p.title}
      onBack={p.onBack}
      testID={p.testID}
      rightAction={isAi && p.coins !== undefined ? <CoinPill coins={p.coins} /> : undefined}
      footer={
        <View style={{ gap: ms(8) }}>
          <ActionButton testID={p.footerTestID} fullWidth title={p.footerTitle} onPress={p.onContinue} />
          {p.footerSecondary ? (
            <ActionButton testID={p.footerSecondary.testID} fullWidth variant="secondary" title={p.footerSecondary.title} onPress={p.footerSecondary.onPress} />
          ) : null}
        </View>
      }
    >
      {p.topSlot}

      {p.mode === 'VS_AI' && p.difficulty && p.onDifficultyChange ? (
        <Section label="Difficulty">
          {AI_LEVELS.map((lvl) => {
            const selected = p.difficulty === lvl.id;
            const Icon = LEVEL_ICON[lvl.id];
            const filled = STRENGTH[lvl.id];
            const levelColor: Record<Difficulty, string> = {
              EASY: c.success,
              MEDIUM: c.accent,
              HARD: c.warning,
              EXPERT: c.accentSecondary,
              IMPOSSIBLE: c.danger,
            };
            return (
              <OptionCard key={lvl.id} testID={`difficulty-${lvl.id}`} a11yLabel={`${lvl.title}. ${lvl.note}`} selected={selected} onPress={() => p.onDifficultyChange!(lvl.id)} style={styles.rowCard}>
                <View style={[styles.iconBox, { backgroundColor: c.bgElevated }]}>
                  <Icon size={ms(18)} color={levelColor[lvl.id]} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={[type.bodyStrong, { color: c.text }]}>{lvl.title}</Text>
                  <Text style={[type.small, { color: c.textSecondary }]}>{lvl.note}</Text>
                  <View style={styles.strength}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <View key={n} style={[styles.strengthBar, { backgroundColor: n <= filled ? levelColor[lvl.id] : c.border }]} />
                    ))}
                  </View>
                </View>
              </OptionCard>
            );
          })}
        </Section>
      ) : p.mode === 'LOCAL_2P' ? (
        <Section label="Players">
          <ProtoInput
            testID="p1-name"
            label="Player 1 Name"
            value={p.p1Name ?? ''}
            onChangeText={p.onP1NameChange}
            placeholder="Player 1"
            maxLength={30}
            error={p.nameErrors?.p1}
          />
          <ProtoInput
            testID="p2-name"
            label="Player 2 Name"
            value={p.p2Name ?? ''}
            onChangeText={p.onP2NameChange}
            placeholder="Player 2"
            maxLength={30}
            error={p.nameErrors?.p2}
          />
        </Section>
      ) : null}

      <Section label="Board size">
        <View style={styles.row}>
          {BOARD_OPTIONS.map((b) => {
            const selected = p.size === b.size;
            return (
              <OptionCard key={b.size} testID={`size-option-${b.size}`} a11yLabel={`${b.label}, ${b.sub}`} selected={selected} onPress={() => p.onSizeChange(b.size)} style={styles.sizeCard}>
                <MiniBoard size={b.size} color={selected ? c.accent : c.border} />
                <Text style={[type.bodyStrong, { color: selected ? c.accent : c.text }]}>{b.label}</Text>
                <Text style={[type.small, { color: c.textSecondary, textAlign: 'center' }]}>{b.sub}</Text>
              </OptionCard>
            );
          })}
        </View>
      </Section>

      {p.mode !== 'ONLINE' ? (
      <Section label={isAi ? 'You play as' : 'Player 1 plays as'}>
        <View style={styles.row}>
          {markOptions.map((m) => {
            const selected = p.markChoice === m.choice;
            return (
              <OptionCard key={m.choice} testID={`mark-option-${m.choice}`} a11yLabel={m.label} selected={selected} onPress={() => p.onMarkChoiceChange?.(m.choice)} style={styles.markCard}>
                {m.choice === 'RANDOM' ? <Shuffle size={ms(22)} color={c.text} /> : <SymbolMark value={m.choice} size="sm" animate={false} />}
                <Text style={[type.small, { color: selected ? c.accent : c.text }]}>{m.label}</Text>
              </OptionCard>
            );
          })}
        </View>
        {isAi ? (
          <View style={styles.hint}>
            <Info size={ms(14)} color={c.textSecondary} />
            <Text style={[type.small, { color: c.textSecondary }]}>X always makes the first move</Text>
          </View>
        ) : null}
      </Section>
      ) : null}

      {p.entryAmount !== undefined && p.onEntryAmountChange ? (
        <Section label="Entry (coins)">
          <View style={styles.row}>
            {ENTRY_OPTIONS.map((e) => {
              const selected = p.entryAmount === e.value;
              return (
                <OptionCard key={e.value} testID={`entry-${e.value}`} a11yLabel={`${e.label} entry`} selected={selected} onPress={() => p.onEntryAmountChange!(e.value)} style={styles.markCard}>
                  <Text style={[type.bodyStrong, { color: selected ? c.accent : c.text }]}>{e.label}</Text>
                </OptionCard>
              );
            })}
          </View>
          <Text style={[type.small, { color: c.textSecondary }]}>Each player pays when the match starts. The winner takes both entries.</Text>
        </Section>
      ) : null}

      {p.turnTimer !== undefined && p.onTurnTimerChange ? (
        <Section label="Turn timer">
          <View style={styles.row}>
            {TIMER_OPTIONS.map((t) => {
              const selected = p.turnTimer === t.value;
              return (
                <OptionCard key={t.value} testID={`timer-${t.value}`} a11yLabel={`${t.label} turn timer`} selected={selected} onPress={() => p.onTurnTimerChange!(t.value)} style={styles.markCard}>
                  <Text style={[type.bodyStrong, { color: selected ? c.accent : c.text }]}>{t.label}</Text>
                </OptionCard>
              );
            })}
          </View>
        </Section>
      ) : null}

      {p.mode !== 'VS_AI' && p.firstMove !== undefined && p.onFirstMoveChange ? (
        <Section label="Who goes first">
          <View style={styles.row}>
            {(p.firstMoveOptions ?? FIRST_MOVE_OPTIONS).map((f) => {
              const selected = p.firstMove === f.id;
              return (
                <OptionCard key={f.id} testID={`first-${f.id}`} a11yLabel={`${f.label} goes first`} selected={selected} onPress={() => p.onFirstMoveChange!(f.id)} style={styles.markCard}>
                  <Text style={[type.small, { color: selected ? c.accent : c.text }]}>{f.label}</Text>
                </OptionCard>
              );
            })}
          </View>
        </Section>
      ) : null}

    </Screen>
  );
};

const styles = StyleSheet.create({
  coinPill: { paddingHorizontal: ms(10), paddingVertical: ms(5), borderRadius: 999, borderWidth: 1 },
  coinText: { ...type.num, },
  group: { gap: 8 },
  card: { alignItems: 'center', paddingHorizontal: ms(12), paddingVertical: ms(10), borderRadius: 12 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: ms(36), height: ms(36), borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  strength: { flexDirection: 'row', gap: 4, marginTop: 2 },
  strengthBar: { width: ms(16), height: ms(4), borderRadius: 2 },
  row: { flexDirection: 'row', gap: 8 },
  sizeCard: { flex: 1, gap: 6, paddingVertical: ms(12), paddingHorizontal: 6 },
  markCard: { flex: 1, height: ms(72), justifyContent: 'center', gap: 6 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },

  // Match ready sheet
  versus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  player: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 16 },
  computerCard: { paddingHorizontal: 8 },
  avatar: { width: ms(56), height: ms(56), borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  table: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
});
