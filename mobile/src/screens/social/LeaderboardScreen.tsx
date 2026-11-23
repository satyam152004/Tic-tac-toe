import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Crown } from 'lucide-react-native';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { fonts } from '../../design-system/typography';
import { useLeaderboard } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import { toApiError } from '../../services/api/errors';
import type { LeaderboardScope } from '../../services/api/leaderboardApi';
import type { LeaderboardRow } from '../../services/api/types';
import { useAuthStore } from '../../store/authStore';
import { isOffline } from './socialShared';

const SCOPES: Array<{ id: LeaderboardScope; label: string }> = [
  { id: 'global', label: 'Global' },
  { id: 'friends', label: 'Friends' },
  { id: 'weekly', label: 'Weekly' },
];

export const LeaderboardScreen: React.FC = () => {
  const c = useTheme();
  const { nav, goTab } = useAppNav();
  const me = useAuthStore((s) => s.user);
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const q = useLeaderboard(scope, 'points');
  const rows = q.isPlaceholderData ? [] : q.data?.rows ?? [];

  const top3 = useMemo(() => rows.slice(0, 3), [rows]);
  const restRows = useMemo(() => rows.slice(3), [rows]);

  const open = (r: LeaderboardRow) => {
    if (r.user.id === me?.id) goTab('ProfileTab');
    else nav.navigate('friend_profile', { userId: r.user.id });
  };

  const myRank = q.data?.me?.rank ?? null;
  const myPoints = q.data?.me?.points ?? null;
  const weekly = scope === 'weekly';
  // Period boards carry the ELO gained in the period, so they read as a delta.
  const fmtPts = (n: number | null | undefined) =>
    n == null ? '–' : weekly ? `${n >= 0 ? '+' : ''}${n.toLocaleString()}` : n.toLocaleString();
  const scopeRankLabel = scope === 'friends' ? 'Friends Rank' : weekly ? 'Weekly Rank' : 'Your Rank';
  const nameOf = (r?: LeaderboardRow) => (r ? (r.user.displayName || r.user.username) + (r.user.id === me?.id ? ' (You)' : '') : '—');
  const initials = (r?: LeaderboardRow) => (r ? (r.user.displayName || r.user.username).slice(0, 2).toUpperCase() : '–');

  const podiumSide = (r: LeaderboardRow | undefined, rank: number) => (
    <View style={styles.podiumCol}>
      <Pressy
        disabled={!r}
        onPress={r ? () => open(r) : undefined}
        accessibilityLabel={r ? `Rank ${rank}, ${nameOf(r)}` : `Rank ${rank}, empty`}
        style={[styles.podiumCard, { backgroundColor: c.bgCard, borderColor: c.border }]}
      >
        <Text style={[styles.podiumElo, { color: c.textSecondary }]}>#{rank}</Text>
        <View style={[styles.podiumAvatar, { backgroundColor: '#F1F1EE' }]}>
          <Text style={[styles.podiumAvatarText, { color: c.text }]}>{initials(r)}</Text>
        </View>
        <Text numberOfLines={1} style={[styles.podiumName, { color: c.text }]}>
          {nameOf(r)}
        </Text>
        <Text style={[styles.podiumElo, { color: c.textSecondary }]}>{r ? fmtPts(r.points) : '–'}</Text>
      </Pressy>
    </View>
  );

  const first = top3[0];
  const header = (
    <View style={{ gap: 10, marginBottom: 10 }}>
      {/* Scope Segment Tabs */}
      <View style={[styles.segment, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
        {SCOPES.map((s) => {
          const active = s.id === scope;
          return (
            <Pressy
              key={s.id}
              testID={`lb-scope-${s.id}`}
              accessibilityLabel={`${s.label} leaderboard`}
              onPress={() => setScope(s.id)}
              style={[styles.segmentBtn, active && [styles.segmentBtnActive, { backgroundColor: c.bgCard }]]}
            >
              <Text style={[styles.segmentText, { color: active ? c.accent : c.textSecondary }]}>{s.label}</Text>
            </Pressy>
          );
        })}
      </View>

      {/* Podium: #2 left, #1 centre (crown), #3 right */}
      <View style={styles.podiumContainer} testID="lb-podium">
        {podiumSide(top3[1], 2)}
        <View style={styles.podiumCol}>
          <Pressy
            disabled={!first}
            onPress={first ? () => open(first) : undefined}
            accessibilityLabel={first ? `Rank 1, ${nameOf(first)}` : 'Rank 1, empty'}
            style={[styles.podiumCard, { backgroundColor: '#EFF4FF', borderColor: c.accent, borderRadius: 13 }]}
          >
            <Crown size={14} color="#B45309" />
            <View style={[styles.podiumAvatar, styles.podiumAvatarLg, { backgroundColor: c.accent }]}>
              <Text style={[styles.podiumAvatarText, { color: '#FFFFFF' }]}>{initials(first)}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.podiumName, { color: c.text }]}>
              {nameOf(first)}
            </Text>
            <Text style={[styles.podiumElo, { color: c.accent, fontFamily: fonts.mono.semibold }]}>{first ? fmtPts(first.points) : '–'}</Text>
          </Pressy>
        </View>
        {podiumSide(top3[2], 3)}
      </View>
    </View>
  );

  return (
    <Screen
      title="Leaderboard"
      tabs
      scroll={false}
      padded={false}
      footer={
        <View testID="lb-me-card" style={styles.footerBar}>
          <Text style={styles.footerText}>
            {scopeRankLabel} {myRank != null ? `#${myRank}` : '–'}
          </Text>
          <Text style={styles.footerText}>{fmtPts(myPoints)} ELO</Text>
        </View>
      }
    >
      {q.isLoading && rows.length === 0 ? (
        <AppLoader label="Loading rankings..." />
      ) : q.isError && rows.length === 0 ? (
        <View style={{ padding: 20 }}>
          <ErrorState
            offline={isOffline(q.error)}
            message={isOffline(q.error) ? 'Connect to the internet to see rankings.' : toApiError(q.error).message}
            onRetry={() => void q.refetch()}
          />
        </View>
      ) : (
        <FlatList
          testID="lb-list"
          data={restRows}
          ListEmptyComponent={
            rows.length === 0 ? (
              <EmptyState
                title={scope === 'friends' ? 'No friends ranked yet' : 'No players yet'}
                description={scope === 'friends' ? 'Add friends and play to see how you compare.' : 'Climb the ranks by playing online matches.'}
              />
            ) : undefined
          }
          keyExtractor={(r) => r.user.id}
          renderItem={({ item: r, index }) => {
            const wr = r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0;
            return (
              <Pressy
                onPress={() => open(r)}
                accessibilityLabel={`Rank ${r.rank}, ${r.user.displayName || r.user.username}`}
                style={[
                  styles.rowItem,
                  { backgroundColor: c.bgCard, borderColor: c.border },
                  index === 0 && styles.rowFirst,
                  index === restRows.length - 1 && styles.rowLast,
                  index > 0 && { borderTopWidth: 0 },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.rowRank, { color: '#8E939E' }]}>#{r.rank}</Text>
                  <Text style={[styles.rowName, { color: c.text }]}>{nameOf(r)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={[styles.rowWr, { color: '#8E939E' }]}>{wr}%</Text>
                  <Text style={[styles.rowElo, { color: c.text }]}>{fmtPts(r.points)}</Text>
                </View>
              </Pressy>
            );
          }}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.accent} />}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 2, borderRadius: 9, borderWidth: 1 },
  segmentBtn: { flex: 1, paddingVertical: 4, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  segmentBtnActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  segmentText: { fontSize: 11, fontFamily: fonts.body.semibold },
  podiumContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  podiumCol: { flex: 1 },
  podiumCard: { borderRadius: 14, borderWidth: 1, padding: 8, alignItems: 'center', gap: 2 },
  podiumAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  podiumAvatarLg: { width: 28, height: 28, borderRadius: 14 },
  podiumAvatarText: { fontSize: 10, fontFamily: fonts.body.semibold },
  podiumName: { fontSize: 11, fontFamily: fonts.body.semibold, marginTop: 2, maxWidth: '100%' },
  podiumElo: { fontSize: 10, fontFamily: fonts.mono.medium },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 29, paddingVertical: 4.5, paddingHorizontal: 12, borderWidth: 1 },
  rowFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  rowLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  rowRank: { fontSize: 10.5, fontFamily: fonts.mono.semibold, width: 24 },
  rowName: { fontSize: 11.5, fontFamily: fonts.body.medium },
  rowWr: { fontSize: 10, fontFamily: fonts.mono.medium },
  rowElo: { fontSize: 11, fontFamily: fonts.mono.semibold },
  footerBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 11, fontFamily: fonts.mono.semibold, color: '#1D4ED8' },
});
