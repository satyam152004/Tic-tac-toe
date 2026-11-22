import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Award, Check, Trophy } from 'lucide-react-native';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
import { useAchievements } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import type { AchievementItem } from '../../services/api/types';

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[_\s])(\w)/g, (_m, sep: string, ch: string) => (sep ? ' ' : '') + ch.toUpperCase());

const AchievementRow: React.FC<{ item: AchievementItem }> = ({ item: a }) => {
  const c = useTheme();
  const pct = Math.min(100, Math.round((a.progress / Math.max(1, a.target)) * 100));
  const done = a.unlocked || pct >= 100;

  return (
    <View
      testID={`achievement-${a.key}`}
      accessibilityLabel={`${a.name}, ${done ? 'unlocked' : `${pct}% completed`}`}
      style={[styles.row, { borderBottomColor: c.border }]}
    >
      <View style={styles.rowTop}>
        <View style={styles.rowLeft}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: done ? '#F0FDF4' : '#EFF4FF',
                borderColor: done ? '#DCFCE7' : '#DBEAFE',
              },
            ]}
          >
            {done ? <Check size={16} color="#15803D" strokeWidth={2.5} /> : <Trophy size={16} color="#1D4ED8" />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[styles.itemTitle, { color: c.text }]}>
              {a.name}
            </Text>
            <Text numberOfLines={1} style={[styles.itemDesc, { color: c.textSecondary }]}>
              {a.description}
            </Text>
          </View>
        </View>

        <Text style={[styles.itemProg, { color: c.textSecondary }]}>
          {Math.min(a.progress, a.target)}/{a.target}
        </Text>
      </View>

      {/* Progress Track */}
      <View style={[styles.track, { backgroundColor: c.bgSecondary }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(4, pct)}%`,
              backgroundColor: done ? '#15803D' : '#1D4ED8',
            },
          ]}
        />
      </View>
    </View>
  );
};

export const AchievementsScreen: React.FC<RootScreenProps<'achievements'>> = () => {
  const c = useTheme();
  const { back } = useAppNav();
  const q = useAchievements();
  const [category, setCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const items = q.data?.items ?? [];
  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const shown = category === 'All' ? items : items.filter((i) => i.category === category);
  const err = q.error && !q.data ? toApiError(q.error) : null;

  const total = q.data?.total ?? items.length;
  const unlockedCount = q.data?.unlockedCount ?? items.filter((i) => i.unlocked).length;
  const overallPct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  };

  return (
    <Screen
      title="Achievements"
      onBack={back}
      scroll={false}
      padded={false}
      rightAction={
        q.data ? (
          <View style={styles.headerRight}>
            <Text style={[styles.headerCount, { color: c.accent }]}>
              {unlockedCount} / {total}
            </Text>
          </View>
        ) : undefined
      }
    >
      {err ? (
        <View style={{ padding: 16 }}>
          <ErrorState offline={err.code === 'NETWORK_ERROR'} message={friendlyMessage(err)} onRetry={() => void q.refetch()} />
        </View>
      ) : q.isLoading ? (
        <AppLoader label="Loading achievements..." />
      ) : (
        <FlatList
          testID="achievement-list"
          data={shown}
          keyExtractor={(i) => i.key}
          renderItem={({ item }) => <AchievementRow item={item} />}
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 8 }}>
              {/* Overall Completion Card */}
              <AppCard padding="md" style={styles.overviewCard}>
                <View style={styles.overviewHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Award size={18} color={c.accent} />
                    <Text style={[styles.overviewTitle, { color: c.text }]}>Overall Completion</Text>
                  </View>
                  <Text style={[styles.overviewPct, { color: c.accent }]}>{overallPct}%</Text>
                </View>
                <View style={[styles.overviewTrack, { backgroundColor: c.bgSecondary }]}>
                  <View style={[styles.overviewFill, { width: `${Math.max(2, overallPct)}%`, backgroundColor: c.accent }]} />
                </View>
              </AppCard>

              {/* Category Pills */}
              {categories.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {categories.map((cat) => {
                    const active = cat === category;
                    return (
                      <Pressy
                        key={cat}
                        testID={`ach-filter-${cat}`}
                        accessibilityLabel={cat === 'All' ? 'All' : titleCase(cat)}
                        onPress={() => setCategory(cat)}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: active ? c.accent : c.bgCard,
                            borderColor: active ? c.accent : c.border,
                          },
                        ]}
                      >
                        <Text style={[styles.filterChipText, { color: active ? '#FFFFFF' : c.textSecondary }]}>
                          {cat === 'All' ? 'All' : titleCase(cat)}
                        </Text>
                      </Pressy>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          }
          ListEmptyComponent={<EmptyState title="No achievements yet" description="Play games to start unlocking achievements." />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.accent} />}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerRight: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  headerCount: {
    fontSize: 12,
    fontFamily: fonts.mono.semibold,
  },
  overviewCard: {
    gap: 10,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overviewTitle: {
    fontSize: 13,
    fontFamily: fonts.body.semibold,
  },
  overviewPct: {
    fontSize: 12,
    fontFamily: fonts.mono.semibold,
  },
  overviewTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  overviewFill: {
    height: '100%',
    borderRadius: 999,
  },
  filterChip: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    justifyContent: 'center',
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11.5,
    fontFamily: fonts.body.semibold,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 12.5,
    fontFamily: fonts.body.semibold,
  },
  itemDesc: {
    fontSize: 10.5,
    marginTop: 1,
  },
  itemProg: {
    fontSize: 11,
    fontFamily: fonts.mono.medium,
  },
  track: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
