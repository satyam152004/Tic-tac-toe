import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Award, Lock, Zap } from 'lucide-react-native';
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

/**
 * Local variant of the shared AchievementCard: achievements pay XP (and ranking points), never coins,
 * so the reward chip uses a bolt icon instead of the shared card's coin.
 */
const XpAchievementCard: React.FC<{ item: AchievementItem }> = ({ item: a }) => {
  const c = useTheme();
  const pct = Math.min(100, Math.round((a.progress / Math.max(1, a.target)) * 100));
  return (
    <AppCard selected={a.unlocked} testID={`achievement-${a.key}`} style={{ gap: 10 }} accessibilityLabel={`${a.name}, ${a.unlocked ? 'unlocked' : `${pct} percent`}`}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View
          style={{
            width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
            backgroundColor: a.unlocked ? c.success + '33' : c.bgElevated, borderColor: a.unlocked ? c.success + '66' : c.border,
          }}
        >
          {a.unlocked ? <Award size={20} color={c.success} /> : <Lock size={20} color={c.textSecondary} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[type.subheading, { color: c.text }]}>{a.name}</Text>
          <Text style={[type.small, { color: c.textSecondary, marginTop: 2 }]}>{a.description}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-start' }}>
          <Zap size={14} color={c.warning} />
          <Text style={[type.num, { fontSize: 12, color: c.warning }]}>+{a.reward.xp} XP</Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[type.caption, { color: c.textSecondary }]}>{titleCase(a.category)} · {a.unlocked ? 'Unlocked' : 'In Progress'}</Text>
          <Text style={[type.caption, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>{Math.min(a.progress, a.target)}/{a.target}</Text>
        </View>
        <View style={{ height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: c.bgSecondary }}>
          <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: a.unlocked ? c.success : c.accent }} />
        </View>
      </View>
    </AppCard>
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

  const onRefresh = async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  };

  const subtitle = q.data ? `${q.data.unlockedCount} of ${q.data.total} unlocked` : undefined;

  return (
    <Screen title="Achievements" subtitle={subtitle} onBack={back} scroll={false} padded={false}>
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
          renderItem={({ item }) => <XpAchievementCard item={item} />}
          ListHeaderComponent={
            categories.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginBottom: 4 }}>
                {categories.map((cat) => {
                  const active = cat === category;
                  return (
                    <Pressy
                      key={cat}
                      testID={`ach-filter-${cat}`}
                      accessibilityLabel={cat === 'All' ? 'All' : titleCase(cat)}
                      accessibilityState={{ selected: active }}
                      onPress={() => setCategory(cat)}
                      style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', backgroundColor: active ? c.accent : c.bgCard, borderWidth: active ? 0 : 1, borderColor: c.border }}
                    >
                      <Text style={[type.smallStrong, { color: active ? '#fff' : c.textSecondary }]}>{cat === 'All' ? 'All' : titleCase(cat)}</Text>
                    </Pressy>
                  );
                })}
              </ScrollView>
            ) : undefined
          }
          ListEmptyComponent={<EmptyState title="No achievements yet" description="Play games to start unlocking achievements." />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.accent} />}
        />
      )}
    </Screen>
  );
};
