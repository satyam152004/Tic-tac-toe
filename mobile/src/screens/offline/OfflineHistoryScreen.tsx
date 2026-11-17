import { useFocusEffect } from '@react-navigation/native';
import { Calendar, CheckCircle2, CloudOff, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppCard } from '../../components/common/AppCard';
import { AppIconButton } from '../../components/common/AppIconButton';
import { ConfirmDialog } from '../../components/common/AppModal';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { type } from '../../design-system/typography';
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
  // saveMatch stores (X name, O name) as (p1Name, p2Name)
  const winnerName = r.result === 'X' ? m.p1Name : r.result === 'O' ? m.p2Name : null;
  return {
    opponent: `${m.p1Name} vs ${m.p2Name}`,
    avatar: undefined,
    mode: '2 Players',
    result: winnerName ? 'played' : 'draw',
    label: winnerName ? `${winnerName} won` : 'Draw',
  };
}

export const OfflineHistoryScreen: React.FC<RootScreenProps<'offline_history'>> = () => {
  const c = useTheme();
  const { nav, goTab } = useAppNav();
  const version = useLocalGameStore((s) => s.historyVersion);
  const [items, setItems] = useState<StoredMatch[] | null>(null);
  const [error, setError] = useState(false);
  const [toDelete, setToDelete] = useState<StoredMatch | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setItems(await localGameStorage.listMatches());
    } catch {
      setError(true);
    }
  }, []);

  // reload on focus and whenever a new match was stored
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

  const tone = { win: c.success, loss: '#F87171', draw: c.warning, played: c.accent };

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
          <AppIconButton testID="history-clear" label="Clear all history" icon={<Trash2 size={16} color="#F87171" />} onPress={() => setConfirmClear(true)} />
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
                    <View style={[styles.badge, { backgroundColor: tone[v.result] + '26', borderColor: tone[v.result] + '66' }]}>
                      <Text numberOfLines={1} style={[type.smallStrong, { color: tone[v.result] }]}>{v.label}</Text>
                    </View>
                    <AppIconButton testID={`history-delete-${item.id}`} label="Delete match" icon={<Trash2 size={14} color={c.textSecondary} />} onPress={() => setToDelete(item)} style={{ width: 44, height: 44 }} />
                  </View>
                </View>
              </AppCard>
            );
          }}
        />
      )}

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
});
