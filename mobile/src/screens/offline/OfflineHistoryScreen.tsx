import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppModal, ConfirmDialog } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { BoardCell, GameBoard } from '../../components/game/GameBoard';
import { fonts } from '../../design-system/typography';
import { Cell, evaluate } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { StoredMatch, localGameStorage } from '../../services/storage/localGameStorage';
import { useLocalGameStore } from '../../store/localGameStore';
import { formatDurationMs, formatShortDate } from '../../utils/format';

import { ch, fs, ms } from '../../design-system/responsive';
const DIFF_LABEL: Record<string, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard', EXPERT: 'Expert', IMPOSSIBLE: 'Unbeatable' };

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toDateString() === new Date().toDateString() ? 'Today' : formatShortDate(iso);
}

export interface MatchView {
  opponent: string;
  avatar: string | undefined;
  mode: string;
  result: 'win' | 'loss' | 'draw' | 'played';
  label: string;
  /** "AI Hard • 3×3" / "Pass & Play • 4×4" */
  title: string;
}

/** Presentation helper: human perspective for VS_AI, winner name for two-player games. */
export function describeMatch(m: StoredMatch): MatchView {
  const r = m.record;
  if (r.mode === 'VS_AI') {
    const result = r.result === 'DRAW' ? 'draw' : r.result === r.humanMark ? 'win' : 'loss';
    return {
      opponent: 'Vortex AI',
      avatar: 'av_ai',
      mode: `vs AI${r.difficulty ? ` · ${r.difficulty[0]}${r.difficulty.slice(1).toLowerCase()}` : ''}`,
      result,
      label: result === 'win' ? 'Victory' : result === 'loss' ? 'Defeat' : 'Draw',
      title: `AI ${r.difficulty ? DIFF_LABEL[r.difficulty] ?? r.difficulty : ''} • ${r.config.size}×${r.config.size}`.replace('AI  •', 'AI •'),
    };
  }
  const winnerName = r.result === 'X' ? m.p1Name : r.result === 'O' ? m.p2Name : null;
  return {
    opponent: `${m.p1Name} vs ${m.p2Name}`,
    avatar: undefined,
    mode: 'Pass & Play',
    result: winnerName ? 'played' : 'draw',
    label: winnerName ? `${winnerName} won` : 'Draw',
    title: `Pass & Play • ${r.config.size}×${r.config.size}`,
  };
}

export const LocalReplayModal: React.FC<{ match: StoredMatch | null; onClose: () => void }> = ({ match, onClose }) => {
  const c = useTheme();
  const total = match?.record.moves.length ?? 0;
  const [step, setStep] = useState(total);

  React.useEffect(() => {
    setStep(match?.record.moves.length ?? 0);
  }, [match]);

  const { board, winLine } = useMemo(() => {
    if (!match) return { board: [] as BoardCell[], winLine: null as number[] | null };
    const sz = match.record.config.size;
    const cells: Cell[] = Array<Cell>(sz * sz).fill('');
    const moves = match.record.moves.slice(0, step);
    moves.forEach((pos, idx) => {
      cells[pos] = idx % 2 === 0 ? 'X' : 'O';
    });
    const out = step === total ? evaluate(cells, match.record.config) : { status: 'IN_PROGRESS' as const };
    return { board: cells as BoardCell[], winLine: out.status === 'WIN' ? out.line : null };
  }, [match, step, total]);

  if (!match) return null;
  const sz = match.record.config.size;
  const lastPos = step > 0 ? match.record.moves[step - 1] ?? null : null;

  return (
    <AppModal open={!!match} title="Match Replay" onClose={onClose}>
      <Text style={[styles.replaySubtitle, { color: c.textSecondary }]}>
        {match.p1Name} vs {match.p2Name} · {sz}×{sz} Grid
      </Text>
      <GameBoard
        compact
        disabled
        board={board}
        size={sz}
        winningLine={winLine}
        lastMoveIndex={lastPos}
        maxSize={260}
      />
      <Text style={[styles.replayStep, { color: c.textSecondary }]}>
        {step === 0 ? 'Start' : `Move ${step} of ${total}`}
      </Text>
      <View style={styles.replayRow}>
        <AppButton
          title="Prev"
          variant="outline"
          size="md"
          icon={<ChevronLeft size={ms(20)} color={c.text} />}
          disabled={step === 0}
          onPress={() => setStep((s) => Math.max(0, s - 1))}
          style={{ flex: 1 }}
        />
        <AppButton
          title="Next"
          size="md"
          icon={<ChevronRight size={ms(20)} color="#FFFFFF" />}
          disabled={step >= total}
          onPress={() => setStep((s) => Math.min(total, s + 1))}
          style={{ flex: 1 }}
        />
      </View>
    </AppModal>
  );
};

type FilterKey = 'all' | 'wins' | 'draws';

export const OfflineHistoryScreen: React.FC<RootScreenProps<'offline_history'>> = () => {
  const c = useTheme();
  const { nav, goTab, back } = useAppNav();
  const version = useLocalGameStore((s) => s.historyVersion);
  const [items, setItems] = useState<StoredMatch[] | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [error, setError] = useState(false);
  const [toDelete, setToDelete] = useState<StoredMatch | null>(null);
  const [replaying, setReplaying] = useState<StoredMatch | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setItems(await localGameStorage.listMatches());
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, version]),
  );

  const remove = async (m: StoredMatch) => {
    setToDelete(null);
    try {
      await localGameStorage.deleteMatch(m.id);
    } finally {
      await load();
    }
  };

  const clearAll = async () => {
    setConfirmClear(false);
    try {
      await localGameStorage.clearMatches();
    } finally {
      await load();
    }
  };

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (filter === 'wins') {
      return items.filter((m) => {
        const v = describeMatch(m);
        return v.result === 'win' || v.result === 'played';
      });
    }
    if (filter === 'draws') {
      return items.filter((m) => describeMatch(m).result === 'draw');
    }
    return items;
  }, [items, filter]);

  return (
    <Screen
      title="Match History"
      onBack={back}
      scroll={false}
      padded={false}
      testID="offline-history"
      rightAction={
        items && items.length > 0 ? (
          <Pressy testID="history-clear" accessibilityLabel="Clear all history" onPress={() => setConfirmClear(true)} hitSlop={10}>
            <Text style={[styles.clearText, { color: c.dangerText }]} numberOfLines={1}>Clear</Text>
          </Pressy>
        ) : undefined
      }
    >
      {/* Filter Pills */}
      {items && items.length > 0 ? (
        <View style={styles.filterBar}>
          {(['all', 'wins', 'draws'] as const).map((key) => {
            const active = filter === key;
            const count =
              key === 'all'
                ? items.length
                : key === 'wins'
                  ? items.filter((m) => describeMatch(m).result === 'win' || describeMatch(m).result === 'played').length
                  : items.filter((m) => describeMatch(m).result === 'draw').length;

            const label = key === 'all' ? `All ${count}` : key === 'wins' ? `Wins ${count}` : `Draws ${count}`;

            return (
              <Pressy
                key={key}
                accessibilityLabel={label}
                onPress={() => setFilter(key)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? c.accentFill : c.bgCard,
                    borderColor: active ? c.accentFill : c.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: active ? '#FFFFFF' : c.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </Pressy>
            );
          })}
        </View>
      ) : null}

      {error ? (
        <View style={styles.pad}>
          <ErrorState message="Couldn't load your match history." onRetry={() => void load()} />
        </View>
      ) : items === null ? (
        <AppLoader />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={[styles.pad, { flexGrow: 1 }]}
          ListEmptyComponent={
            <EmptyState
              title="No matches yet"
              description="Finish an offline match and it will show up here."
              actionLabel="Play now"
              onAction={() => goTab('HomeTab')}
            />
          }
          renderItem={({ item, index }) => {
            const v = describeMatch(item);
            const isWin = v.result === 'win' || v.result === 'played';
            const isLoss = v.result === 'loss';
            const badge = isWin ? 'W' : isLoss ? 'L' : 'D';
            const badgeBg = isWin ? '#F0FDF4' : isLoss ? '#FEF2F2' : c.bgSecondary;
            const badgeColor = isWin ? '#15803D' : isLoss ? '#B91C1C' : c.textSecondary;
            const first = index === 0;
            const last = index === filteredItems.length - 1;

            return (
              <Pressy
                testID={`history-row-${item.id}`}
                accessibilityLabel={`${v.label}, ${v.title}. Replay match`}
                onPress={() => setReplaying(item)}
                scaleTo={0.995}
                style={[
                  styles.row,
                  {
                    backgroundColor: c.bgCard,
                    borderColor: c.border,
                    borderTopWidth: 1,
                    borderBottomWidth: last ? 1 : 0,
                    borderTopLeftRadius: first ? 14 : 0,
                    borderTopRightRadius: first ? 14 : 0,
                    borderBottomLeftRadius: last ? 14 : 0,
                    borderBottomRightRadius: last ? 14 : 0,
                  },
                ]}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[styles.opponentName, { color: c.text }]}>{v.title}</Text>
                    <Text numberOfLines={1} style={[styles.metaText, { color: '#8E939E' }]}>
                      {item.record.moves.length} moves • {dayLabel(item.record.playedAt)}
                    </Text>
                  </View>
                </View>
                <View style={styles.replayBtn}>
                  <Text style={[styles.replayText, { color: c.accent }]}>Replay</Text>
                  <ChevronRight size={ms(15)} color={c.accent} />
                </View>
              </Pressy>
            );
          }}
        />
      )}

      <LocalReplayModal match={replaying} onClose={() => setReplaying(null)} />

      <ConfirmDialog
        open={confirmClear}
        title="Clear Match History?"
        message="This deletes all your offline matches from this phone."
        confirmLabel="Clear History"
        destructive
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: ms(20),
    paddingTop: 0,
    paddingBottom: ms(24),
  },
  filterBar: {
    flexDirection: 'row',
    gap: ms(6),
    paddingHorizontal: ms(20),
    paddingTop: ms(8),
    paddingBottom: ms(14),
  },
  filterPill: {
    paddingHorizontal: ms(10),
    paddingVertical: ms(4),
    borderRadius: ms(8),
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: fs(11),
    fontFamily: fonts.body.semibold,
  },
  row: {
    minHeight: ch(38),
    paddingVertical: ms(10),
    paddingHorizontal: ms(13),
    borderLeftWidth: 1,
    borderRightWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ms(8),
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    flex: 1,
  },
  badge: {
    width: ms(28.8),
    height: ms(28.8),
    borderRadius: ms(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: fs(11),
    fontFamily: fonts.body.semibold,
  },
  opponentName: {
    fontSize: fs(12.5),
    fontFamily: fonts.body.semibold,
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
  },
  replayText: {
    fontSize: fs(11),
    fontFamily: fonts.body.semibold,
  },
  clearText: {
    fontSize: fs(11),
    fontFamily: fonts.body.semibold,
  },
  metaText: {
    fontSize: fs(10.5),
    fontFamily: fonts.body.regular,
  },
  replaySubtitle: {
    fontSize: fs(12),
    fontFamily: fonts.body.medium,
    textAlign: 'center',
  },
  replayStep: {
    fontSize: fs(12),
    fontFamily: fonts.mono.medium,
    textAlign: 'center',
  },
  replayRow: {
    flexDirection: 'row',
    gap: ms(10),
    marginTop: ms(10),
  },
});
