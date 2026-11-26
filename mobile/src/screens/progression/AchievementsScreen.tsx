import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, Trophy } from 'lucide-react-native';
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

import { fs, ms } from '../../design-system/responsive';
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[_\s])(\w)/g, (_m, sep: string, ch: string) => (sep ? ' ' : '') + ch.toUpperCase());

const AchievementRow: React.FC<{ item: AchievementItem; first?: boolean }> = ({ item: a, first }) => {
  const c = useTheme();
  const pct = Math.min(100, Math.round((a.progress / Math.max(1, a.target)) * 100));
  const done = a.unlocked || pct >= 100;

  return (
    <View
      testID={`achievement-${a.key}`}
      accessibilityLabel={`${a.name}, ${done ? 'unlocked' : `${pct}% done`}`}
      style={[styles.row, { borderTopColor: c.border, borderTopWidth: first ? 0 : 1 }]}
    >
      <View style={styles.rowTop}>
        <View style={styles.rowLeft}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: done ? '#F0FDF4' : '#EFF4FF',
              },
            ]}
          >
            {done ? <Check size={ms(16)} color="#15803D" strokeWidth={2.5} /> : <Trophy size={ms(16)} color="#1D4ED8" />}
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
              width: `${pct}%`,
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
            <Text style={[styles.headerCount, { color: c.accent }]} numberOfLines={1}>
              {unlockedCount} / {total}
            </Text>
          </View>
        ) : undefined
      }
    >
      {err ? (
        <View style={{ flex: 1, padding: 16 }}>
          <ErrorState offline={err.code === 'NETWORK_ERROR'} message={friendlyMessage(err)} onRetry={() => void q.refetch()} />
        </View>
      ) : q.isLoading ? (
        <AppLoader label="Loading achievements..." />
      ) : (
        <ScrollView
          testID="achievement-list"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.accent} />}
        >
          <View style={{ gap: 12, marginBottom: 8 }}>
              {/* Overall Completion Card */}
              <AppCard padding="md" style={styles.overviewCard}>
                <View style={styles.overviewHeader}>
                  <Text style={[styles.overviewTitle, { color: c.text }]}>Overall Completion</Text>
                  <Text style={[styles.overviewPct, { color: c.accent }]}>{overallPct}%</Text>
                </View>
                <View style={[styles.overviewTrack, { backgroundColor: c.bgSecondary }]}>
                  <View style={[styles.overviewFill, { width: `${overallPct}%`, backgroundColor: c.accent }]} />
                </View>
              </AppCard>

              {/* Category Pills */}
              {categories.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {categories.map((cat) => {
                    const active = cat === category;
                    return (
                      <Pressy
                        key={cat}
                        hitSlop={4}
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
          {shown.length === 0 ? (
            <EmptyState title="No achievements yet" description="Play a few games to earn your first one." />
          ) : (
            <View style={[styles.group, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              {shown.map((item, i) => (
                <AchievementRow key={item.key} item={item} first={i === 0} />
              ))}
            </View>
          )}
        </ScrollView>
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
    fontSize: fs(12),
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
    fontSize: fs(12),
    fontFamily: fonts.body.semibold,
  },
  overviewPct: {
    fontSize: fs(11),
    fontFamily: fonts.mono.semibold,
  },
  overviewTrack: {
    height: ms(8),
    borderRadius: 999,
    overflow: 'hidden',
  },
  overviewFill: {
    height: '100%',
    borderRadius: 999,
  },
  filterChip: {
    minHeight: 40,
    paddingHorizontal: ms(14),
    borderRadius: 999,
    justifyContent: 'center',
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: fs(11.5),
    fontFamily: fonts.body.semibold,
  },
  group: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  row: {
    paddingVertical: ms(12),
    paddingHorizontal: ms(14),
    gap: ms(8),
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
    gap: ms(10),
    marginRight: 10,
  },
  iconBox: {
    width: ms(30),
    height: ms(30),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: fs(12),
    fontFamily: fonts.body.semibold,
  },
  itemDesc: {
    fontSize: fs(10),
    marginTop: 1,
  },
  itemProg: {
    fontSize: fs(10),
    fontFamily: fonts.mono.medium,
  },
  track: {
    height: ms(5),
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
