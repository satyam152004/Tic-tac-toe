import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Crown } from 'lucide-react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { LeaderboardItem, LeaderboardView } from '../../components/profile/Cards';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useLeaderboard } from '../../hooks/queries';
import { useAppNav } from '../../navigation/useAppNav';
import { toApiError } from '../../services/api/errors';
import type { LeaderboardMetric, LeaderboardScope } from '../../services/api/leaderboardApi';
import type { LeaderboardRow } from '../../services/api/types';
import { useAuthStore } from '../../store/authStore';
import { isOffline } from './socialShared';

const SCOPES: Array<{ id: LeaderboardScope; label: string; empty: string; emptyDesc: string }> = [
  { id: 'global', label: 'Global', empty: 'No ranked games yet', emptyDesc: 'Finish an online game to appear on the board.' },
  { id: 'daily', label: 'Daily', empty: 'No ranked games today yet', emptyDesc: 'Be the first to play today and take the top spot.' },
  { id: 'weekly', label: 'Weekly', empty: 'No ranked games this week yet', emptyDesc: 'Play online matches this week to climb the ranks.' },
  { id: 'monthly', label: 'Monthly', empty: 'No ranked games this month yet', emptyDesc: 'Play online matches this month to climb the ranks.' },
  { id: 'friends', label: 'Friends', empty: 'No friends on the board', emptyDesc: 'Add friends and play online to compare rankings.' },
];
const METRICS: Array<{ id: LeaderboardMetric; label: string }> = [
  { id: 'points', label: 'Points' },
  { id: 'wins', label: 'Wins' },
];
const EMPTY_ROWS: LeaderboardRow[] = [];

export const LeaderboardScreen: React.FC = () => {
  const c = useTheme();
  const { nav, goTab } = useAppNav();
  const me = useAuthStore((s) => s.user);
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [metric, setMetric] = useState<LeaderboardMetric>('points');
  const q = useLeaderboard(scope, metric);
  const meta = SCOPES.find((s) => s.id === scope)!;
  const label = metric === 'wins' ? 'Wins' : 'Points';
  const rows = q.isPlaceholderData ? EMPTY_ROWS : q.data?.rows ?? EMPTY_ROWS;

  const toView = (r: LeaderboardRow): LeaderboardView => ({
    rank: r.rank,
    id: r.user.id,
    username: r.user.displayName || r.user.username,
    avatarId: r.user.avatar,
    wins: r.wins,
    rating: metric === 'wins' ? r.wins : r.points,
    winRate: r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0,
    isCurrentUser: r.isMe === true || r.user.id === me?.id,
  });
  const open = (r: LeaderboardRow) => (toView(r).isCurrentUser ? goTab('ProfileTab') : nav.navigate('friend_profile', { userId: r.user.id }));
  const top = useMemo(() => rows.slice(0, 3), [rows]);

  const header = (
    <View style={{ gap: 16 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopes}>
        {SCOPES.map((s) => {
          const on = s.id === scope;
          return (
            <Pressy
              key={s.id}
              testID={`lb-scope-${s.id}`}
              accessibilityLabel={`${s.label} leaderboard`}
              accessibilityState={{ selected: on }}
              onPress={() => setScope(s.id)}
              style={[styles.chip, { backgroundColor: on ? c.accent : c.bgCard, borderColor: on ? c.accent : c.border }]}
            >
              <Text style={[type.smallStrong, { color: on ? '#fff' : c.textSecondary }]}>{s.label}</Text>
            </Pressy>
          );
        })}
      </ScrollView>
      <View style={[styles.metrics, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        {METRICS.map((m) => {
          const on = m.id === metric;
          return (
            <Pressy
              key={m.id}
              testID={`lb-metric-${m.id}`}
              accessibilityLabel={`Sort by ${m.label}`}
              accessibilityState={{ selected: on }}
              onPress={() => setMetric(m.id)}
              style={[styles.metric, { backgroundColor: on ? c.accent : 'transparent' }]}
            >
              <Text style={[type.smallStrong, { color: on ? '#fff' : c.textSecondary }]}>{m.label}</Text>
            </Pressy>
          );
        })}
      </View>

      {q.data?.me && !q.isPlaceholderData ? (
        <AppCard selected padding="sm" testID="lb-me-card">
          <Text style={[type.smallStrong, { color: c.textSecondary }]}>Your rank</Text>
          {q.data.me.rank === null ? (
            <Text testID="lb-me-unranked" style={[type.body, { color: c.text, marginTop: 4 }]}>
              You are not ranked here yet. Finish an online game to get on the board.
            </Text>
          ) : (
            <View style={styles.meRow}>
              <Text style={[type.title, { color: c.accent, fontSize: 24 }]}>#{q.data.me.rank}</Text>
              <Text style={[type.body, { color: c.text }]}>
                {q.data.me.points} pts · {q.data.me.wins} wins
              </Text>
            </View>
          )}
        </AppCard>
      ) : null}

      {top.length >= 3 ? (
        <View style={styles.podium} testID="lb-podium">
          {[1, 0, 2].map((i) => {
            const r = top[i]!;
            const v = toView(r);
            const first = i === 0;
            return (
              <AppCard key={r.user.id} selected={first} padding="sm" onPress={() => open(r)} style={{ flex: 1, alignItems: 'center', gap: 6, paddingBottom: first ? 16 : 12 }}>
                {first ? <Crown size={20} color={c.warning} /> : <Text style={[type.num, { fontSize: 12, color: i === 1 ? c.accentSecondary : c.o }]}>#{r.rank}</Text>}
                <AppAvatar avatarId={v.avatarId} name={v.username} size={first ? 'lg' : 'md'} activeRing={first} />
                <Text numberOfLines={1} style={[type.smallStrong, { color: c.text }]}>{v.username}</Text>
                <Text style={[type.num, { fontSize: 11, color: first ? c.warning : c.textSecondary }]}>{v.rating}</Text>
              </AppCard>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  let empty: React.ReactNode = null;
  if (q.isLoading || q.isPlaceholderData) empty = <AppLoader label="Loading rankings..." />;
  else if (q.isError && rows.length === 0) {
    const off = isOffline(q.error);
    empty = (
      <ErrorState
        offline={off}
        message={off ? 'Connect to the internet to see the leaderboard.' : toApiError(q.error).message}
        onRetry={() => void q.refetch()}
      />
    );
  } else if (rows.length === 0) empty = <EmptyState title={meta.empty} description={meta.emptyDesc} />;

  return (
    <Screen title="Leaderboard" subtitle="Season standings" tabs scroll={false} padded={false}>
      <FlatList
        testID="lb-list"
        data={rows}
        keyExtractor={(r) => r.user.id}
        renderItem={({ item }) => <LeaderboardItem entry={toView(item)} ratingLabel={label} onPress={() => open(item)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={<>{empty}</>}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isPlaceholderData} onRefresh={() => void q.refetch()} tintColor={c.accent} />}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  scopes: { gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 16, borderWidth: 1 },
  metric: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  podium: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
});
