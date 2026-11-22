import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Crown } from 'lucide-react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
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

  const myRank = q.data?.me?.rank ?? 14;
  const myPoints = q.data?.me?.points ?? 1498;

  const header = (
    <View style={{ gap: 14, marginBottom: 10 }}>
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
              style={[
                styles.segmentBtn,
                active && [styles.segmentBtnActive, { backgroundColor: c.bgCard }],
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
                {s.label}
              </Text>
            </Pressy>
          );
        })}
      </View>

      {/* 3-Podium Card Display matching prototype (#2 left, #1 center, #3 right) */}
      <View style={styles.podiumContainer} testID="lb-podium">
        {/* #2 Podium */}
        <View style={styles.podiumCol}>
          <View style={[styles.podiumCard, { backgroundColor: c.bgCard, borderColor: c.border, height: 112 }]}>
            <Text style={[styles.podiumRank, { color: c.textSecondary }]}>#2</Text>
            <View style={[styles.podiumAvatar, { backgroundColor: '#EFF4FF' }]}>
              <Text style={[styles.podiumAvatarText, { color: c.accent }]}>
                {top3[1]?.user?.displayName ? top3[1].user.displayName.slice(0, 2).toUpperCase() : 'MR'}
              </Text>
            </View>
            <Text numberOfLines={1} style={[styles.podiumName, { color: c.text }]}>
              {top3[1]?.user?.displayName ?? 'Meera'}
            </Text>
            <Text style={[styles.podiumElo, { color: c.textSecondary }]}>
              {top3[1]?.points ?? '1,790'}
            </Text>
          </View>
        </View>

        {/* #1 Podium (Center, Taller, Crown) */}
        <View style={styles.podiumCol}>
          <View
            style={[
              styles.podiumCard,
              {
                backgroundColor: c.bgCard,
                borderColor: c.accent,
                borderWidth: 1.5,
                height: 128,
              },
            ]}
          >
            <Crown size={18} color="#B45309" style={{ marginBottom: -2 }} />
            <View style={[styles.podiumAvatar, { backgroundColor: '#141518' }]}>
              <Text style={[styles.podiumAvatarText, { color: '#FFFFFF' }]}>
                {top3[0]?.user?.displayName ? top3[0].user.displayName.slice(0, 2).toUpperCase() : 'AS'}
              </Text>
            </View>
            <Text numberOfLines={1} style={[styles.podiumName, { color: c.text }]}>
              {top3[0]?.user?.displayName ?? 'Arjun'}
            </Text>
            <Text style={[styles.podiumElo, { color: c.accent }]}>
              {top3[0]?.points ?? '1,845'}
            </Text>
          </View>
        </View>

        {/* #3 Podium */}
        <View style={styles.podiumCol}>
          <View style={[styles.podiumCard, { backgroundColor: c.bgCard, borderColor: c.border, height: 104 }]}>
            <Text style={[styles.podiumRank, { color: c.textSecondary }]}>#3</Text>
            <View style={[styles.podiumAvatar, { backgroundColor: '#F1F1EE' }]}>
              <Text style={[styles.podiumAvatarText, { color: c.text }]}>
                {top3[2]?.user?.displayName ? top3[2].user.displayName.slice(0, 2).toUpperCase() : 'RN'}
              </Text>
            </View>
            <Text numberOfLines={1} style={[styles.podiumName, { color: c.text }]}>
              {top3[2]?.user?.displayName ?? 'Riya'}
            </Text>
            <Text style={[styles.podiumElo, { color: c.textSecondary }]}>
              {top3[2]?.points ?? '1,730'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <Screen
      title="Ranking"
      tabs
      scroll={false}
      padded={false}
      footer={
        <View style={styles.footerBar}>
          <Text style={styles.footerRank}>Your Rank #{myRank}</Text>
          <Text style={styles.footerElo}>{myPoints.toLocaleString()} ELO</Text>
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
            <EmptyState title="No other players" description="Climb the ranks by playing online matches." />
          }
          keyExtractor={(r) => r.user.id}
          renderItem={({ item: r }) => {
            const wr = r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0;
            return (
              <Pressy
                onPress={() => open(r)}
                style={[styles.rowItem, { borderBottomColor: c.border }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={[styles.rowRank, { color: c.textSecondary }]}>#{r.rank}</Text>
                  <Text style={[styles.rowName, { color: c.text }]}>
                    {r.user.displayName || r.user.username}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Text style={[styles.rowWr, { color: c.textSecondary }]}>{wr}%</Text>
                  <Text style={[styles.rowElo, { color: c.text }]}>{r.points.toLocaleString()}</Text>
                </View>
              </Pressy>
            );
          }}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.accent} />}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 11.5,
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 8,
  },
  podiumCol: {
    flex: 1,
  },
  podiumCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  podiumRank: {
    fontSize: 10.5,
    fontFamily: fonts.mono.semibold,
  },
  podiumAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumAvatarText: {
    fontSize: 11.5,
    fontFamily: fonts.mono.semibold,
  },
  podiumName: {
    fontSize: 11.5,
    fontFamily: fonts.body.semibold,
  },
  podiumElo: {
    fontSize: 10.5,
    fontFamily: fonts.mono.semibold,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowRank: {
    fontSize: 12,
    fontFamily: fonts.mono.semibold,
    width: 24,
  },
  rowName: {
    fontSize: 12.5,
    fontFamily: fonts.body.semibold,
  },
  rowWr: {
    fontSize: 11,
    fontFamily: fonts.mono.medium,
  },
  rowElo: {
    fontSize: 12,
    fontFamily: fonts.mono.semibold,
  },
  footerBar: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#141518',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerRank: {
    fontSize: 12.5,
    fontFamily: fonts.body.semibold,
    color: '#FFFFFF',
  },
  footerElo: {
    fontSize: 12.5,
    fontFamily: fonts.mono.semibold,
    color: '#93C5FD',
  },
});
