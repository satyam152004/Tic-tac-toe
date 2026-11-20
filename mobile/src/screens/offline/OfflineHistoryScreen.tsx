import { useFocusEffect } from '@react-navigation/native';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, CloudOff, Play, Trash2 } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppIconButton } from '../../components/common/AppIconButton';
import { AppModal, ConfirmDialog } from '../../components/common/AppModal';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { BoardCell, GameBoard } from '../../components/game/GameBoard';
import { withAlpha } from '../../design-system/colors';
import { type } from '../../design-system/typography';
import { checkOutcome } from '../../game-engine';
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
    mode: '2 Players',
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
    const cells: BoardCell[] = Array<BoardCell>(sz * sz).fill('');
    const moves = match.record.moves.slice(0, step);
    moves.forEach((pos, idx) => {
      cells[pos] = idx % 2 === 0 ? 'X' : 'O';
    });
    const out = step === total ? checkOutcome(cells, match.record.config) : { status: 'IN_PROGRESS' as const };
    return { board: cells, winLine: out.status === 'WIN' ? out.line : null };
  }, [match, step, total]);

  if (!match) return null;
  const sz = match.record.config.size;
  const lastPos = step > 0 ? match.record.moves[step - 1] ?? null : null;

  return (
    <AppModal open={!!match} title="Match Replay" onClose={onClose}>
      <Text style={[type.small, { color: c.textSecondary, textAlign: 'center' }]}>
        {match.p1Name} vs {match.p2Name} · {sz}×{sz} Grid
      </Text>
      <GameBoard
        compact
        disabled
        board={board}
        size={sz}
        winningLine={winLine}
        lastMoveIndex={lastPos}
        maxSize={280}
      />
      <Text style={[type.smallStrong, { color: c.textSecondary, textAlign: 'center' }]}>
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

export const OfflineHistoryScreen: React.FC<RootScreenProps<'offline_history'>> = () => {
  const c = useTheme();
  const { nav, goTab } = useAppNav();
  const version = useLocalGameStore((s) => s.historyVersion);
  const [items, setItems] = useState<StoredMatch[] | null>(null);
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

  const tone = { win: c.success, loss: c.dangerText, draw: c.warning, played: c.accent };

  return (
    <Screen
      title="Match History"
      subtitle="Offline & AI rounds on this device"
      onBack={() => nav.goBack()}
      scroll={false}
      padded={false}
      testID="offline-history"
      rightAction={
        items && items.length > 0 ? (
          <AppIconButton testID="history-clear" label="Clear all history" icon={<Trash2 size={16} color={c.dangerText} />} onPress={() => setConfirmClear(true)} />
        ) : undefined
      }
    >
      {error ? (
        <View style={styles.pad}>
          <ErrorState message="Could not read your match history." onRetry={() => void load()} />
        </View>
      ) : items === null ? (
        <AppLoader />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={[styles.pad, { gap: 10, flexGrow: 1 }]}
          ListEmptyComponent={
            <EmptyState title="No Matches Played Yet" description="Complete an offline or AI match to see your round history here." actionLabel="Play now" onAction={() => goTab('PlayTab')} />
          }
          renderItem={({ item }) => {
            const v = describeMatch(item);
            return (
              <AppCard testID={`history-row-${item.id}`} padding="sm">
                <View style={styles.row}>
                  <AppAvatar avatarId={v.avatar} name={v.opponent} size="sm" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>{v.opponent}</Text>
                    <Text numberOfLines={1} style={[type.caption, { color: c.textSecondary, marginTop: 2 }]}>
                      {v.mode} · {item.record.config.size}x{item.record.config.size}
                    </Text>
                    <View style={[styles.row, { gap: 4, marginTop: 2 }]}>
                      <Calendar size={11} color={c.textSecondary} />
                      <Text style={[type.caption, { color: c.textSecondary }]}>{formatShortDate(item.playedAt)}</Text>
                      <Text style={[type.caption, { color: c.textSecondary }]}> · {formatDurationMs(item.record.durationMs)} · {item.record.moves.length} moves</Text>
                    </View>
                    <View accessibilityLabel={item.synced ? 'Synced to account' : 'Stored on this device'} style={[styles.row, { gap: 4, marginTop: 2 }]}>
                      {item.synced ? <CheckCircle2 size={11} color={c.success} /> : <CloudOff size={11} color={c.textSecondary} />}
                      <Text style={[type.caption, { color: item.synced ? c.success : c.textSecondary }]}>{item.synced ? 'Synced to account' : 'On this device'}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.badge, { backgroundColor: withAlpha(tone[v.result], 0.14), borderColor: withAlpha(tone[v.result], 0.4) }]}>
                      <Text numberOfLines={1} style={[type.smallStrong, { color: tone[v.result] }]}>{v.label}</Text>
                    </View>
                    <View style={styles.row}>
                      <AppIconButton testID={`history-replay-${item.id}`} label="Replay match" icon={<Play size={14} color={c.accent} />} onPress={() => setReplaying(item)} style={{ width: 44, height: 44 }} />
                      <AppIconButton testID={`history-delete-${item.id}`} label="Delete match" icon={<Trash2 size={14} color={c.textSecondary} />} onPress={() => setToDelete(item)} style={{ width: 44, height: 44 }} />
                    </View>
                  </View>
                </View>
              </AppCard>
            );
          }}
        />
      )}

      <LocalReplayModal match={replaying} onClose={() => setReplaying(null)} />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete match?"
        message="This match will be removed from this device."
        confirmLabel="Delete"
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
      <ConfirmDialog
        open={confirmClear}
        title="Clear all history?"
        message="All offline matches stored on this device will be deleted."
        confirmLabel="Clear all"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => void clearAll()}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  pad: { padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3, maxWidth: 140 },
  replayRow: { flexDirection: 'row', gap: 10 },
});
