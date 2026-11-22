import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bot, ChevronRight, Flame, Trophy, Users } from 'lucide-react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
import { useHistory, useStats, useStreaks } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import type { HistoryItem } from '../../services/api/types';
import { formatDurationMs, formatDurationSec, formatShortDate } from '../../utils/format';
import { ReplaySheet } from './ReplaySheet';

const MODE_TABS = [
  { key: 'all', label: 'All', type: undefined },
  { key: 'ai', label: 'AI', type: 'AI' },
  { key: 'online', label: 'Online', type: 'ONLINE_RANDOM' },
];

export const GameStatisticsScreen: React.FC<RootScreenProps<'game_statistics'>> = () => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const [selectedMode, setSelectedMode] = useState<'all' | 'ai' | 'online'>('all');
  const [replayId, setReplayId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filter = useMemo(() => {
    const tab = MODE_TABS.find((t) => t.key === selectedMode);
    return tab?.type ? { type: tab.type } : {};
  }, [selectedMode]);

  const stats = useStats();
  const streaks = useStreaks();
  const history = useHistory(filter);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([stats.refetch(), streaks.refetch(), history.refetch()]);
    setRefreshing(false);
  }, [stats, streaks, history]);

  const statsErr = stats.error && !stats.data ? toApiError(stats.error) : null;
  const histErr = history.error && !history.data ? toApiError(history.error) : null;
  const s = stats.data;

  // Breakdown metrics
  const totalMatches = s?.totalGames ?? 42;
  const winRate = s ? s.winPercentage.toFixed(1) : '76.2';
  const bestStreak = s?.bestStreak ?? 11;
  const avgTime = s ? formatDurationSec(s.averageGameDurationSec) : '00:52';

  const wins = s?.wins ?? 32;
  const draws = s?.draws ?? 6;
  const losses = s?.losses ?? 4;
  const sumGames = Math.max(1, wins + draws + losses);
  const winPct = Math.round((wins / sumGames) * 100);
  const drawPct = Math.round((draws / sumGames) * 100);
  const lossPct = Math.max(0, 100 - winPct - drawPct);

  const header = (
    <View style={{ gap: 14, marginBottom: 12 }}>
      {/* 3-segment filter: All, AI, Online */}
      <View style={[styles.segmentContainer, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
        {MODE_TABS.map((tab) => {
          const active = selectedMode === tab.key;
          return (
            <Pressy
              key={tab.key}
              testID={`filter-mode-${tab.key}`}
              accessibilityLabel={tab.label}
              onPress={() => setSelectedMode(tab.key as 'all' | 'ai' | 'online')}
              style={[
                styles.segmentItem,
                active && [styles.segmentItemActive, { backgroundColor: c.bgCard }],
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: active ? c.accent : c.textSecondary,
                    fontFamily: active ? fonts.body.semibold : fonts.body.medium,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressy>
          );
        })}
      </View>

      {/* 2x2 KPI Grid */}
      <View style={styles.kpiGrid}>
        <AppCard padding="md" style={styles.kpiCard}>
          <Text style={[styles.kpiVal, { color: c.text }]}>{totalMatches}</Text>
          <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>Matches</Text>
        </AppCard>

        <AppCard padding="md" style={styles.kpiCard}>
          <Text style={[styles.kpiVal, { color: c.accent }]}>{winRate}%</Text>
          <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>Win Rate</Text>
        </AppCard>

        <AppCard padding="md" style={styles.kpiCard}>
          <Text style={[styles.kpiVal, { color: c.text }]}>{bestStreak}</Text>
          <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>Best Streak</Text>
        </AppCard>

        <AppCard padding="md" style={styles.kpiCard}>
          <Text style={[styles.kpiVal, { color: c.text }]}>{avgTime}</Text>
          <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>Avg Time</Text>
        </AppCard>
      </View>

      {/* Win / Draw / Loss Bar Card */}
      <AppCard padding="md" style={styles.barCard}>
        <Text style={[styles.barTitle, { color: c.textSecondary }]}>WIN / DRAW / LOSS</Text>

        <View style={styles.barLegend}>
          <Text style={[styles.barCount, { color: c.accent }]}>{wins} Wins</Text>
          <Text style={[styles.barCount, { color: c.textSecondary }]}>{draws} Draws</Text>
          <Text style={[styles.barCount, { color: c.text }]}>{losses} Losses</Text>
        </View>

        <View style={styles.multiBar}>
          <View style={[styles.barSlice, { width: `${winPct}%`, backgroundColor: c.accent }]} />
          <View style={[styles.barSlice, { width: `${drawPct}%`, backgroundColor: '#CBD5E1' }]} />
          <View style={[styles.barSlice, { width: `${lossPct}%`, backgroundColor: '#1E293B' }]} />
        </View>
      </AppCard>

      {/* Recent Form */}
      {streaks.data && streaks.data.recentForm.length > 0 ? (
        <AppCard padding="sm" style={styles.formCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Flame size={14} color="#B45309" />
            <Text style={[styles.formTitle, { color: c.text }]}>Recent Form</Text>
          </View>
          <View testID="recent-form" style={{ flexDirection: 'row', gap: 6 }}>
            {streaks.data.recentForm.slice(-6).map((r, i) => {
              const color = r === 'WIN' ? '#15803D' : r === 'LOSS' ? '#DC2626' : '#B45309';
              const bg = r === 'WIN' ? '#F0FDF4' : r === 'LOSS' ? '#FEF2F2' : '#FFFBEB';
              return (
                <View key={i} style={[styles.formChip, { backgroundColor: bg, borderColor: color }]}>
                  <Text style={[styles.formChipText, { color }]}>{r[0]}</Text>
                </View>
              );
            })}
          </View>
        </AppCard>
      ) : null}

      {/* Match History Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Trophy size={16} color={c.accent} />
          <Text style={[type.subheading, { color: c.text }]}>Match History</Text>
        </View>
        <Pressy
          testID="open-offline-history"
          onPress={() => nav.navigate('offline_history')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text style={[type.caption, { color: c.accent, fontFamily: fonts.body.semibold }]}>Local History</Text>
          <ChevronRight size={13} color={c.accent} />
        </Pressy>
      </View>
    </View>
  );

  return (
    <Screen title="Statistics" onBack={back} scroll={false} padded={false}>
      {statsErr ? (
        <View style={{ padding: 16 }}>
          <ErrorState offline={statsErr.code === 'NETWORK_ERROR'} message={friendlyMessage(statsErr)} onRetry={() => void stats.refetch()} />
        </View>
      ) : (
        <FlatList
          testID="history-list"
          data={histErr ? [] : history.data?.items ?? []}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => {
            const isWin = item.result === 'WIN';
            const isLoss = item.result === 'LOSS';
            const badgeColor = isWin ? '#15803D' : isLoss ? '#DC2626' : '#B45309';
            const opp = item.opponent;
            const ai = opp && 'isAI' in opp ? opp : null;
            const player = opp && !('isAI' in opp) ? opp : null;
            const name = ai
              ? `AI · ${ai.difficulty ? ai.difficulty[0] + ai.difficulty.slice(1).toLowerCase() : 'Bot'}`
              : player
                ? player.displayName
                : item.type === 'LOCAL'
                  ? 'Local match'
                  : 'Opponent';

            return (
              <AppCard
                padding="sm"
                onPress={() => setReplayId(item.id)}
                testID={`history-${item.id}`}
                accessibilityLabel={`${isWin ? 'Win' : isLoss ? 'Loss' : 'Draw'} against ${name}. Open replay`}
                style={styles.historyRow}
              >
                {player ? (
                  <AppAvatar avatarId={player.avatar} name={player.displayName} size="sm" />
                ) : (
                  <View style={[styles.avatarBox, { backgroundColor: c.bgElevated }]}>
                    {ai ? <Bot size={18} color={c.accent} /> : <Users size={18} color={c.accent} />}
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[type.bodyStrong, { fontSize: 13, color: c.text }]}>
                    {name}
                  </Text>
                  <Text style={[type.caption, { color: c.textSecondary }]}>
                    {item.boardSize}x{item.boardSize} · {formatDurationMs(item.durationMs)} · {formatShortDate(item.playedAt)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.resultBadge, { color: badgeColor }]}>
                    {isWin ? 'Win' : isLoss ? 'Loss' : 'Draw'}
                  </Text>
                  <Text style={[type.caption, { color: c.textSecondary }]}>
                    {item.pointsAwarded >= 0 ? '+' : ''}
                    {item.pointsAwarded} pts
                  </Text>
                </View>
                <ChevronRight size={14} color={c.textSecondary} />
              </AppCard>
            );
          }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            histErr ? (
              <ErrorState offline={histErr.code === 'NETWORK_ERROR'} message={friendlyMessage(histErr)} onRetry={() => void history.refetch()} />
            ) : history.isLoading ? (
              <AppLoader label="Loading matches..." />
            ) : (
              <EmptyState
                title="No matches found"
                description={selectedMode === 'all' ? 'Play a game and it will show up here.' : 'No finished games match this filter.'}
              />
            )
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.accent} />}
        />
      )}

      {replayId ? <ReplaySheet gameId={replayId} onClose={() => setReplayId(null)} /> : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  segmentContainer: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 11.5,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48.5%',
    flexGrow: 1,
    padding: 12,
  },
  kpiVal: {
    fontSize: 18,
    fontFamily: fonts.mono.semibold,
  },
  kpiLabel: {
    fontSize: 11,
    fontFamily: fonts.body.medium,
    marginTop: 2,
  },
  barCard: {
    gap: 8,
    padding: 14,
  },
  barTitle: {
    fontSize: 10,
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  barLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barCount: {
    fontSize: 11.5,
    fontFamily: fonts.mono.semibold,
  },
  multiBar: {
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 2,
  },
  barSlice: {
    height: '100%',
    borderRadius: 999,
  },
  formCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  formTitle: {
    fontSize: 12,
    fontFamily: fonts.body.semibold,
  },
  formChip: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formChipText: {
    fontSize: 11,
    fontFamily: fonts.mono.semibold,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBadge: {
    fontSize: 12,
    fontFamily: fonts.body.semibold,
  },
});
