import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Bot, ChevronRight, Flame, Globe, History, Trophy, Users } from 'lucide-react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { ScoreCard } from '../../components/profile/Cards';
import { type } from '../../design-system/typography';
import { useHistory, useStats, useStreaks } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import type { HistoryItem } from '../../services/api/types';
import { formatDurationMs, formatDurationSec, formatPlayTime, formatShortDate } from '../../utils/format';
import { ReplaySheet } from './ReplaySheet';

interface TypeFilter { key: string; label: string; type?: string }
/** The history endpoint filters by ONE game type, so "Online" is split into its three real sources. */
export const HISTORY_TYPE_FILTERS: TypeFilter[] = [
  { key: 'all', label: 'All' },
  { key: 'ai', label: 'AI', type: 'AI' },
  { key: 'quick', label: 'Quick Match', type: 'ONLINE_RANDOM' },
  { key: 'room', label: 'Rooms', type: 'PRIVATE_ROOM' },
  { key: 'friend', label: 'Friends', type: 'FRIEND' },
];
interface ResultFilter { key: string; label: string; result?: 'WIN' | 'LOSS' | 'DRAW' }
export const HISTORY_RESULT_FILTERS: ResultFilter[] = [
  { key: 'any', label: 'Any result' },
  { key: 'win', label: 'Win', result: 'WIN' },
  { key: 'loss', label: 'Loss', result: 'LOSS' },
  { key: 'draw', label: 'Draw', result: 'DRAW' },
];

const Chip: React.FC<{ label: string; active: boolean; onPress: () => void; testID?: string }> = ({ label, active, onPress, testID }) => {
  const c = useTheme();
  return (
    <Pressy
      testID={testID}
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', backgroundColor: active ? c.accent : c.bgCard, borderWidth: active ? 0 : 1, borderColor: c.border }}
    >
      <Text style={[type.smallStrong, { color: active ? '#fff' : c.textSecondary }]}>{label}</Text>
    </Pressy>
  );
};

const FormChip: React.FC<{ r: 'WIN' | 'LOSS' | 'DRAW' }> = ({ r }) => {
  const c = useTheme();
  const color = r === 'WIN' ? c.success : r === 'LOSS' ? c.danger : c.warning;
  return (
    <View
      accessibilityLabel={r === 'WIN' ? 'Win' : r === 'LOSS' ? 'Loss' : 'Draw'}
      style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: color + '26', borderWidth: 1, borderColor: color + '66' }}
    >
      <Text style={[type.smallStrong, { color }]}>{r[0]}</Text>
    </View>
  );
};

type Tone = 'success' | 'danger' | 'warning';
const resultMeta = (r: HistoryItem['result']): { label: string; tone: Tone } =>
  r === 'WIN' ? { label: 'Win', tone: 'success' } : r === 'LOSS' ? { label: 'Loss', tone: 'danger' } : { label: 'Draw', tone: 'warning' };

const HistoryRow: React.FC<{ item: HistoryItem; onOpen: (id: string) => void }> = ({ item, onOpen }) => {
  const c = useTheme();
  const meta = resultMeta(item.result);
  const color = c[meta.tone];
  const opp = item.opponent;
  const ai = opp && 'isAI' in opp ? opp : null;
  const player = opp && !('isAI' in opp) ? opp : null;
  const name = ai
    ? `AI${ai.difficulty ? ` · ${ai.difficulty[0]}${ai.difficulty.slice(1).toLowerCase()}` : ''}`
    : player
      ? player.displayName
      : item.type === 'LOCAL'
        ? 'Local match'
        : 'Opponent';
  return (
    <AppCard
      padding="sm"
      onPress={() => onOpen(item.id)}
      testID={`history-${item.id}`}
      accessibilityLabel={`${meta.label} against ${name}. Open replay`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      {player ? (
        <AppAvatar avatarId={player.avatar} name={player.displayName} size="sm" />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.bgElevated, alignItems: 'center', justifyContent: 'center' }}>
          {ai ? <Bot size={20} color={c.accent} /> : <Users size={20} color={c.accent} />}
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>{name}</Text>
        <Text style={[type.caption, { color: c.textSecondary }]}>
          {item.boardSize}x{item.boardSize} · {formatDurationMs(item.durationMs)} · {formatShortDate(item.playedAt)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[type.smallStrong, { color }]}>{meta.label}</Text>
        <Text style={[type.caption, { color: c.textSecondary }]}>{item.pointsAwarded >= 0 ? '+' : ''}{item.pointsAwarded} pts</Text>
      </View>
      <ChevronRight size={16} color={c.textSecondary} />
    </AppCard>
  );
};

export const GameStatisticsScreen: React.FC<RootScreenProps<'game_statistics'>> = () => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const [typeKey, setTypeKey] = useState('all');
  const [resultKey, setResultKey] = useState('any');
  const [replayId, setReplayId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filter = useMemo(() => {
    const f: { type?: string; result?: 'WIN' | 'LOSS' | 'DRAW' } = {};
    const t = HISTORY_TYPE_FILTERS.find((x) => x.key === typeKey)?.type;
    const r = HISTORY_RESULT_FILTERS.find((x) => x.key === resultKey)?.result;
    if (t) f.type = t;
    if (r) f.result = r;
    return f;
  }, [typeKey, resultKey]);

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

  const header = (
    <View style={{ gap: 16 }}>
      {statsErr ? (
        <ErrorState offline={statsErr.code === 'NETWORK_ERROR'} message={friendlyMessage(statsErr)} onRetry={() => void stats.refetch()} />
      ) : !s ? (
        <AppLoader label="Loading statistics..." />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ScoreCard label="Total Games" value={s.totalGames} />
            <ScoreCard label="Win Percentage" value={`${Math.round(s.winPercentage)}%`} tone="accent" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ScoreCard label="Wins" value={s.wins} tone="success" />
            <ScoreCard label="Losses / Draws" value={`${s.losses} / ${s.draws}`} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ScoreCard label="Points" value={s.points} tone="warning" />
            <ScoreCard label="Level" value={s.level} subtext={`${s.xp} XP`} tone="accent" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ScoreCard label="Streak" value={s.currentStreak} subtext={`Best ${s.bestStreak}`} tone="success" />
            <ScoreCard label="Play Time" value={formatPlayTime(s.totalPlayTimeSec)} subtext={`Avg ${formatDurationSec(s.averageGameDurationSec)}`} />
          </View>

          <AppCard style={{ gap: 10 }}>
            <Text style={[type.subheading, { color: c.text }]}>Breakdown</Text>
            {[
              { icon: <Bot size={16} color={c.accent} />, label: 'Vs AI', games: s.aiGames, wins: s.aiWins },
              { icon: <Globe size={16} color={c.accentSecondary} />, label: 'Online', games: s.onlineGames, wins: s.onlineWins },
              { icon: <Users size={16} color={c.warning} />, label: 'Local (pass & play)', games: s.local.games, wins: s.local.wins },
            ].map((row) => (
              <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {row.icon}
                <Text style={[type.body, { color: c.text, flex: 1 }]}>{row.label}</Text>
                <Text style={[type.small, { color: c.textSecondary }]}>{row.games} games · {row.wins} wins</Text>
              </View>
            ))}
            <Pressy
              testID="open-offline-history"
              accessibilityLabel="Open local match history"
              onPress={() => nav.navigate('offline_history')}
              style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <History size={16} color={c.accent} />
              <Text style={[type.smallStrong, { color: c.accent, flex: 1 }]}>Local match history (on this device)</Text>
              <ChevronRight size={16} color={c.accent} />
            </Pressy>
          </AppCard>
        </>
      )}

      <AppCard style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Flame size={16} color={c.warning} />
          <Text style={[type.subheading, { color: c.text }]}>Recent Form</Text>
        </View>
        {streaks.data && streaks.data.recentForm.length > 0 ? (
          <View testID="recent-form" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {streaks.data.recentForm.map((r, i) => <FormChip key={i} r={r} />)}
          </View>
        ) : (
          <Text style={[type.small, { color: c.textSecondary }]}>{streaks.isLoading ? 'Loading...' : 'Finish a game to see your form.'}</Text>
        )}
      </AppCard>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Trophy size={16} color={c.accent} />
        <Text style={[type.subheading, { color: c.text }]}>Match History</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {HISTORY_TYPE_FILTERS.map((f) => (
          <Chip key={f.key} testID={`filter-type-${f.key}`} label={f.label} active={typeKey === f.key} onPress={() => setTypeKey(f.key)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {HISTORY_RESULT_FILTERS.map((f) => (
          <Chip key={f.key} testID={`filter-result-${f.key}`} label={f.label} active={resultKey === f.key} onPress={() => setResultKey(f.key)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen title="Game Statistics" onBack={back} scroll={false} padded={false}>
      <FlatList
        testID="history-list"
        data={histErr ? [] : history.data?.items ?? []}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <HistoryRow item={item} onOpen={setReplayId} />}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: 6 }}
        ListEmptyComponent={
          histErr ? (
            <ErrorState offline={histErr.code === 'NETWORK_ERROR'} message={friendlyMessage(histErr)} onRetry={() => void history.refetch()} />
          ) : history.isLoading ? (
            <AppLoader label="Loading matches..." />
          ) : (
            <EmptyState
              title="No matches found"
              description={typeKey === 'all' && resultKey === 'any' ? 'Play a game and it will show up here.' : 'No finished games match these filters.'}
            />
          )
        }
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.accent} />}
      />
      <ReplaySheet gameId={replayId} onClose={() => setReplayId(null)} />
    </Screen>
  );
};
