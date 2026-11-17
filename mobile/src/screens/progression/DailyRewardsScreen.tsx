import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Coins, Flame, Gift, PartyPopper } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { RewardCard } from '../../components/profile/Cards';
import { type } from '../../design-system/typography';
import { useClaimDailyReward, useDailyReward } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { toApiError, friendlyMessage } from '../../services/api/errors';
import { feedback } from '../../services/feedback';
import { toast } from '../../store/toastStore';
import { formatCountdown } from '../../utils/format';

/** Ticks once a second until `targetIso`; calls `onZero` once when it is reached. Returns ms remaining (null without target). */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return (
    <Animated.View testID="claim-celebration" style={[{ borderRadius: 16, borderWidth: 1, borderColor: c.success + '88', backgroundColor: c.success + '22', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, anim]}>
      <PartyPopper size={28} color={c.success} />
      <View style={{ flex: 1 }}>
        <Text style={[type.subheading, { color: c.text }]}>Day {day} claimed!</Text>
        <Text style={[type.num, { color: c.warning }]}>+{coins} coins</Text>
      </View>
    </Animated.View>
  );
};

export const DailyRewardsScreen: React.FC<RootScreenProps<'daily_rewards'>> = () => {
  const c = useTheme();
  const { back } = useAppNav();
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
        toast.error('Could not claim reward', friendlyMessage(err));
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
      ? `Claim Day ${claimable.day} (+${claimable.coins} Coins)`
      : remaining != null
        ? `Next reward in ${formatCountdown(remaining)}`
        : 'Today Reward Claimed';

  return (
    <Screen
      title="Daily Rewards"
      onBack={back}
      scroll={false}
      padded={false}
      rightAction={
        status ? (
          <View testID="coin-balance" accessibilityLabel={`${status.coins} coins`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Coins size={16} color={c.warning} />
            <Text style={[type.num, { fontSize: 12, color: c.warning }]}>{status.coins}</Text>
          </View>
        ) : undefined
      }
      footer={
        status ? (
          <AppButton
            testID="claim-reward"
            fullWidth
            title={label}
            disabled={!status.canClaim}
            loading={claim.isPending}
            onPress={() => void doClaim()}
          />
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
          contentContainerStyle={{ padding: 16, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.accent} />}
        >
          {celebrate ? <Celebration coins={celebrate.coins} day={celebrate.day} onDone={() => setCelebrate(null)} /> : null}

          <AppCard style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: c.warning + '33', alignItems: 'center', justifyContent: 'center' }}>
              <Gift size={24} color={c.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.heading, { color: c.text }]}>7-Day Streak Calendar</Text>
              <Text style={[type.small, { color: c.textSecondary }]}>Log in daily to earn bonus coins. Missing a day restarts the cycle.</Text>
            </View>
          </AppCard>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <AppCard padding="sm" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Flame size={18} color={c.warning} />
              <View>
                <Text testID="reward-streak" style={[type.num, { color: c.text }]}>{status.streak} {status.streak === 1 ? 'day' : 'days'}</Text>
                <Text style={[type.caption, { color: c.textSecondary }]}>Current streak</Text>
              </View>
            </AppCard>
            <AppCard padding="sm" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Coins size={18} color={c.warning} />
              <View>
                <Text style={[type.num, { color: c.text }]}>{status.coins}</Text>
                <Text style={[type.caption, { color: c.textSecondary }]}>Coin balance</Text>
              </View>
            </AppCard>
          </View>

          {[status.cycle.slice(0, 3), status.cycle.slice(3, 6)].map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              {row.map((d) => (
                <RewardCard key={d.day} reward={{ day: d.day, coins: d.coins, status: d.status }} onClaim={() => void doClaim()} />
              ))}
            </View>
          ))}
          {status.cycle[6] ? (
            <RewardCard reward={{ day: status.cycle[6].day, coins: status.cycle[6].coins, status: status.cycle[6].status }} onClaim={() => void doClaim()} />
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
};
