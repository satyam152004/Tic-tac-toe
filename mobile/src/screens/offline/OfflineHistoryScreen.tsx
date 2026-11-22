import { useFocusEffect } from '@react-navigation/native';
import { Calendar, ChevronLeft, ChevronRight, Play, Trash2 } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppIconButton } from '../../components/common/AppIconButton';
import { AppModal, ConfirmDialog } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { BoardCell, GameBoard } from '../../components/game/GameBoard';
import { fonts } from '../../design-system/typography';
import { withAlpha } from '../../design-system/colors';
import { Cell, evaluate } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { StoredMatch, localGameStorage } from '../../services/storage/localGameStorage';
import { useLocalGameStore } from '../../store/localGameStore';
import { formatDurationMs, formatShortDate } from '../../utils/format';

export interface MatchView {
  opponent: string;
  avatar: string | undefined;
  mode: string;
  result: 'win' | 'loss' | 'draw' | 'played';
  label: string;
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
    };
  }
  const winnerName = r.result === 'X' ? m.p1Name : r.result === 'O' ? m.p2Name : null;
  return {
    opponent: `${m.p1Name} vs ${m.p2Name}`,
    avatar: undefined,
    mode: 'Pass & Play',
    result: winnerName ? 'played' : 'draw',
    label: winnerName ? `${winnerName} won` : 'Draw',
  };
}

const LocalReplayModal: React.FC<{ match: StoredMatch | null; onClose: () => void }> = ({ match, onClose }) => {
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
          icon={<ChevronLeft size={16} color={c.text} />}
          disabled={step === 0}
          onPress={() => setStep((s) => Math.max(0, s - 1))}
          style={{ flex: 1 }}
        />
        <AppButton
          title="Next"
          size="md"
          icon={<ChevronRight size={16} color="#FFFFFF" />}
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

  const { height: screenH } = useWindowDimensions();
  const isTall = screenH >= 780;

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
      subtitle="Offline & AI rounds on this device"
      onBack={back}
      scroll={false}
      padded={false}
      testID="offline-history"
      rightAction={
        items && items.length > 0 ? (
          <AppIconButton
            testID="history-clear"
            label="Clear all history"
            icon={<Trash2 size={16} color={c.dangerText} />}
            onPress={() => setConfirmClear(true)}
          />
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
                    backgroundColor: active ? '#1D4ED8' : c.bgCard,
                    borderColor: active ? '#1D4ED8' : c.border,
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
          <ErrorState message="Could not read your match history." onRetry={() => void load()} />
        </View>
      ) : items === null ? (
        <AppLoader />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={[styles.pad, { gap: isTall ? 12 : 10, flexGrow: 1 }]}
          ListEmptyComponent={
            <EmptyState
              title="No Matches Played Yet"
              description="Complete an offline or AI match to see your round history here."
              actionLabel="Play now"
              onAction={() => goTab('PlayTab')}
            />
          }
          renderItem={({ item }) => {
            const v = describeMatch(item);
            const isWin = v.result === 'win' || v.result === 'played';
            const isLoss = v.result === 'loss';
            const badgeBg = isWin ? '#F0FDF4' : isLoss ? '#FEF2F2' : '#F1F1EE';
            const badgeBorder = isWin ? '#BBF7D0' : isLoss ? '#FECACA' : '#E4E4DF';
            const badgeColor = isWin ? '#15803D' : isLoss ? '#DC2626' : '#5C606A';

            return (
              <View
                testID={`history-row-${item.id}`}
                style={[
                  styles.matchCard,
                  {
                    padding: isTall ? 14 : 11,
                    borderRadius: isTall ? 14 : 12,
                    backgroundColor: c.bgCard,
                    borderColor: c.border,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    <View style={[styles.outcomeBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                      <Text style={[styles.outcomeText, { color: badgeColor }]}>{v.label}</Text>
                    </View>
                    <Text numberOfLines={1} style={[styles.opponentName, { color: c.text }]}>
                      {v.opponent}
                    </Text>
                  </View>

                  {/* Replay Button */}
                  <Pressy
                    testID={`history-replay-${item.id}`}
                    accessibilityLabel="Replay match"
                    onPress={() => setReplaying(item)}
                    style={[styles.replayBtn, { backgroundColor: withAlpha(c.accent, 0.12) }]}
                  >
                    <Play size={14} color={c.accent} fill={c.accent} />
                  </Pressy>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={[styles.metaText, { color: c.textSecondary }]}>
                    {v.mode} · {item.record.config.size}×{item.record.config.size} Grid · {item.record.moves.length} moves
                  </Text>
                  <Text style={[styles.metaText, { color: c.textSecondary }]}>
                    {formatDurationMs(item.record.durationMs)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <LocalReplayModal match={replaying} onClose={() => setReplaying(null)} />

      <ConfirmDialog
        open={confirmClear}
        title="Clear Match History?"
        message="This removes all recorded offline matches from your device."
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontFamily: fonts.body.semibold,
  },
  matchCard: {
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  outcomeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  outcomeText: {
    fontSize: 10.5,
    fontFamily: fonts.body.semibold,
  },
  opponentName: {
    fontSize: 13.5,
    fontFamily: fonts.body.semibold,
    flex: 1,
  },
  replayBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 11,
    fontFamily: fonts.body.regular,
  },
  replaySubtitle: {
    fontSize: 12,
    fontFamily: fonts.body.medium,
    textAlign: 'center',
  },
  replayStep: {
    fontSize: 12,
    fontFamily: fonts.mono.medium,
    textAlign: 'center',
  },
  replayRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
});
