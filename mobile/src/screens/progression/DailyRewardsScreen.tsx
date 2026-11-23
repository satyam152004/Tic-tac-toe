import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { ChevronRight, PartyPopper } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
import { useClaimDailyReward, useDailyReward } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { feedback } from '../../services/feedback';
import { toast } from '../../store/toastStore';
import { formatCountdown } from '../../utils/format';

import { fs, ms } from '../../design-system/responsive';
/** Ticks once a second until `targetIso`; calls `onZero` once when reached. */
export function useCountdown(targetIso: string | null | undefined, onZero: () => void): number | null {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<string | null>(null);
  const cb = useRef(onZero);
  cb.current = onZero;
  const target = targetIso ? new Date(targetIso).getTime() : null;

  useEffect(() => {
    if (target == null) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const remaining = target == null ? null : Math.max(0, target - now);
  useEffect(() => {
    if (targetIso && remaining === 0 && fired.current !== targetIso) {
      fired.current = targetIso;
      cb.current();
    }
  }, [remaining, targetIso]);
  return remaining;
}

const Celebration: React.FC<{ coins: number; day: number; onDone: () => void }> = ({ coins, day, onDone }) => {
  const c = useTheme();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withSequence(withTiming(1, { duration: 180 }), withDelay(2200, withTiming(0, { duration: 300 })));
    scale.value = withSpring(1, { damping: 8 });
    const id = setTimeout(onDone, 2700);
    return () => clearTimeout(id);
  }, [onDone, opacity, scale]);

  const anim = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      testID="claim-celebration"
      style={[
        {
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#86EFAC',
          backgroundColor: '#F0FDF4',
          padding: ms(14),
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        anim,
      ]}
    >
      <PartyPopper size={ms(28)} color="#15803D" />
      <View style={{ flex: 1 }}>
        <Text style={[type.subheading, { color: c.text }]}>Day {day} claimed!</Text>
        <Text style={[type.num, { color: '#B45309', fontSize: fs(13) }]}>+{coins} coins</Text>
      </View>
    </Animated.View>
  );
};

export const DailyRewardsScreen: React.FC<RootScreenProps<'daily_rewards'>> = () => {
  const c = useTheme();
  const { height } = useWindowDimensions();
  const isTall = height >= 780;
  const { nav, back } = useAppNav();
  const q = useDailyReward();
  const claim = useClaimDailyReward();
  const [celebrate, setCelebrate] = useState<{ day: number; coins: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const status = q.data;

  const doClaim = useCallback(async () => {
    if (claim.isPending || !status?.canClaim) return;
    try {
      const r = await claim.mutateAsync();
      feedback.result('win');
      setCelebrate(r.claimed);
    } catch (e) {
      const err = toApiError(e);
      if (err.code === 'REWARD_ALREADY_CLAIMED') {
        toast.info('Already claimed', friendlyMessage(err));
        void q.refetch();
      } else {
        feedback.error();
        toast.error("Couldn't claim your reward", friendlyMessage(err));
      }
    }
  }, [claim, status?.canClaim, q]);

  const remaining = useCountdown(status && !status.canClaim ? status.nextClaimAt : null, () => void q.refetch());

  const onRefresh = async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  };

  const err = q.error && !status ? toApiError(q.error) : null;
  const claimable = status?.cycle.find((d) => d.status === 'claimable');
  const label = !status
    ? 'Claim'
    : status.canClaim && claimable
      ? `Claim Day ${claimable.day} reward`
      : remaining != null
        ? `Next reward in ${formatCountdown(remaining)}`
        : "Today's reward claimed";

  const days1to6 = status?.cycle.slice(0, 6) ?? [];

  const day7 = status?.cycle[6] ?? null;

  return (
    <Screen
      title="Daily Rewards"
      onBack={back}
      scroll={false}
      padded={false}
      rightAction={
        status ? (
          <View
            testID="coin-balance"
            accessibilityLabel={`${status.coins} coins`}
            style={styles.coinPill}
          >
            <Text style={styles.coinPillText} numberOfLines={1}>{status.coins.toLocaleString()} Coins</Text>
          </View>
        ) : undefined
      }
      footer={
        status ? (
          <View style={styles.footer}>
            <AppButton
              testID="claim-reward"
              fullWidth
              title={label}
              disabled={!status.canClaim}
              loading={claim.isPending}
              onPress={() => void doClaim()}
            />
          </View>
        ) : undefined
      }
    >
      {err ? (
        <View style={{ padding: 16 }}>
          <ErrorState offline={err.code === 'NETWORK_ERROR'} message={friendlyMessage(err)} onRetry={() => void q.refetch()} />
        </View>
      ) : !status ? (
        <AppLoader label="Loading rewards..." />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { gap: isTall ? 14 : 12, paddingBottom: 24, width: '100%', maxWidth: 560, alignSelf: 'center' },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {celebrate ? <Celebration coins={celebrate.coins} day={celebrate.day} onDone={() => setCelebrate(null)} /> : null}

          {/* 3x2 Grid for Days 1 to 6 */}
          <View style={styles.grid}>
            {days1to6.map((item) => {
              const isToday = item.status === 'claimable';
              const isClaimed = item.status === 'claimed';
              const boxBg = isToday ? '#EFF4FF' : isClaimed ? '#F1F1EE' : c.bgCard;
              const boxBorder = isToday ? '#1D4ED8' : c.border;
              const statusTxt = isClaimed ? '✓ Claimed' : isToday ? 'Active' : 'Upcoming';
              const statusCol = isClaimed ? '#15803D' : isToday ? '#1D4ED8' : c.textSecondary;

              return (
                <Pressy
                  key={item.day}
                  testID={`reward-day-${item.day}`}
                  accessibilityLabel={`Day ${item.day}, ${item.coins} coins, ${statusTxt}`}
                  onPress={isToday ? () => void doClaim() : undefined}
                  style={[
                    styles.dayCard,
                    {
                      backgroundColor: boxBg,
                      borderColor: boxBorder,
                      borderWidth: isToday ? 1.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.dayLabel, { color: isToday ? '#1D4ED8' : c.textSecondary }]}>
                    Day {item.day}
                  </Text>
                  <Text style={[styles.dayValue, { color: c.text }]}>
                    +{item.coins}{isToday ? ' Coins' : ''}
                  </Text>
                  <Text style={[styles.dayStatus, { color: statusCol }]}>
                    {statusTxt}
                  </Text>
                </Pressy>
              );
            })}
          </View>

          {/* Day 7 Grand Chest Banner */}
          {day7 ? (
          <Pressy
            testID="reward-day-7"
            onPress={day7.status === 'claimable' ? () => void doClaim() : undefined}
            style={[
              styles.grandChestCard,
              {
                backgroundColor: day7.status === 'claimable' ? '#EFF4FF' : c.bgCard,
                borderColor: day7.status === 'claimable' ? '#1D4ED8' : c.border,
                borderWidth: day7.status === 'claimable' ? 1.5 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, minWidth: 0 }}>
              <View style={{ flexShrink: 1 }}>
                <Text style={[styles.chestTitle, { color: c.text }]}>Day 7 • Grand Chest</Text>
                <Text style={[styles.chestSub, { color: c.textSecondary }]}>+{day7.coins} Coins & Cobalt Emblem</Text>
              </View>
            </View>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    day7.status === 'claimed' ? '#DCFCE7' : day7.status === 'claimable' ? '#EFF4FF' : '#F1F1EE',
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      day7.status === 'claimed' ? '#15803D' : day7.status === 'claimable' ? '#1D4ED8' : c.textSecondary,
                  },
                ]}
              >
                {day7.status === 'claimed' ? '✓ Claimed' : day7.status === 'claimable' ? 'Active' : 'Upcoming'}
              </Text>
            </View>
          </Pressy>
          ) : null}

          {/* Coin shop entry */}
          <Pressy
            testID="open-coin-shop"
            accessibilityLabel="Emblems & Shop"
            onPress={() => nav.navigate('coin_shop')}
            style={[styles.miniInfo, { backgroundColor: c.bgCard, borderColor: c.border, justifyContent: 'space-between' }]}
          >
            <Text style={[styles.chestTitle, { color: c.text }]}>Emblems & Shop</Text>
            <ChevronRight size={ms(18)} color="#8E939E" />
          </Pressy>
        </ScrollView>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinPillText: {
    fontSize: fs(12),
    fontFamily: fonts.mono.semibold,
    color: '#B45309',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ms(8),
  },
  dayCard: {
    flexBasis: '28%',
    flexGrow: 1,
    paddingVertical: ms(14),
    paddingHorizontal: 6,
    minHeight: ms(84),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: fs(10),
    fontFamily: fonts.body.semibold,
  },
  dayValue: {
    fontSize: fs(12.5),
    fontFamily: fonts.mono.semibold,
    marginTop: 4,
  },
  dayStatus: {
    fontSize: fs(9.5),
    fontFamily: fonts.body.semibold,
    marginTop: 4,
  },
  grandChestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: ms(14),
    gap: 8,
    borderRadius: 12,
  },
  chestIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chestTitle: {
    fontSize: fs(12),
    fontFamily: fonts.body.semibold,
  },
  chestSub: {
    fontSize: fs(10.5),
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: ms(10),
    paddingVertical: ms(4),
    borderRadius: 6,
  },
  badgeText: {
    fontSize: fs(10),
    fontFamily: fonts.body.semibold,
  },
  miniInfo: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: ms(12),
    borderRadius: 12,
    borderWidth: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
});
