import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/common/Screen';
import { fonts, type } from '../../design-system/typography';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { useHistory, useLeaderboard, useMe } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';

import { fs, ms } from '../../design-system/responsive';
export interface DivisionInfo {
  name: string;
  min: number;
  max: number;
  range: string;
  reward: string;
}

export const LEAGUE_DIVISIONS: DivisionInfo[] = [
  { name: 'Platinum', min: 1700, max: 3000, range: '1,700+ pts', reward: '' },
  { name: 'Gold I', min: 1500, max: 1699, range: '1,500 – 1,699 pts', reward: '' },
  { name: 'Gold II', min: 1400, max: 1499, range: '1,400 – 1,499 pts', reward: '' },
  { name: 'Silver', min: 1200, max: 1399, range: '1,200 – 1,399 pts', reward: '' },
  { name: 'Bronze', min: 0, max: 1199, range: 'Below 1,200 pts', reward: '' },
];

export function divisionForPoints(points: number): DivisionInfo {
  return LEAGUE_DIVISIONS.find((d) => points >= d.min) ?? LEAGUE_DIVISIONS[LEAGUE_DIVISIONS.length - 1]!;
}

export const LeagueTiersScreen: React.FC<RootScreenProps<'league_tiers'>> = () => {
  const c = useTheme();
  const { back } = useAppNav();
  const me = useMe();
  const board = useLeaderboard('global', 'points');
  const history = useHistory({});

  if (!me.data) {
    return (
      <Screen title="Ranked Leagues" onBack={back} testID="league-tiers-screen">
        {me.isError ? <ErrorState message="Couldn't load your ranking. Try again." onRetry={() => void me.refetch()} /> : <AppLoader label="Loading league..." />}
      </Screen>
    );
  }

  const points = me.data.stats.points ?? 0;
  const current = divisionForPoints(points);
  const curIdx = LEAGUE_DIVISIONS.findIndex((d) => d.name === current.name);
  const next = curIdx > 0 ? LEAGUE_DIVISIONS[curIdx - 1] : null;
  const progress = next ? Math.min(1, Math.max(0, (points - current.min) / (next.min - current.min))) : 1;
  const rank = board.data?.me?.rank ?? null;
  const last20 = (history.data?.items ?? []).filter((g) => g.result).slice(0, 20);
  const last20Pct = last20.length > 0 ? Math.round((last20.filter((g) => g.result === 'WIN').length / last20.length) * 100) : null;

  const rewardFor = (i: number) => (i === curIdx ? 'Your league' : i > curIdx ? 'Completed' : 'Locked');

  return (
    <Screen title="Ranked Leagues" onBack={back} testID="league-tiers-screen" gap={12}>
      {/* Division Progress Card */}
      <View style={[styles.heroCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        <View style={styles.heroTop}>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <Text style={[styles.tierTag, { color: c.accent }]}>
              {current.name.toUpperCase()}
              {rank != null ? ` • RANK #${rank}` : ''}
            </Text>
            <Text style={[styles.eloText, { color: c.text }]}>
              {points.toLocaleString()} pts
              {next ? (
                <Text style={[styles.eloSub, { color: c.textSecondary }]}>{`  (${(next.min - points).toLocaleString()} to ${next.name})`}</Text>
              ) : null}
            </Text>
          </View>
          {last20Pct != null ? (
            <View style={styles.ratePill}>
              <Text style={styles.ratePillText}>{last20Pct}% Last 20</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.track, { backgroundColor: c.bgSecondary }]}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: c.accent }]} />
        </View>
      </View>

      {/* Divisions List */}
      <View style={[styles.divisionsGroup, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        {LEAGUE_DIVISIONS.map((div, i) => {
          const isCurrent = i === curIdx;
          return (
            <View
              key={div.name}
              style={[styles.divRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }, isCurrent && { backgroundColor: '#EFF4FFA6' }]}
            >
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <Text style={[styles.divName, { color: isCurrent ? c.accent : c.text }]}>{div.name}</Text>
                <Text style={[styles.divRange, { color: c.textSecondary }]}>{div.range}</Text>
              </View>
              <Text style={[styles.divReward, { color: isCurrent ? c.accent : '#8E939E' }]}>{rewardFor(i)}</Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerSeason: {
    fontSize: fs(11),
    fontFamily: fonts.body.semibold,
  },
  heroCard: {
    padding: ms(14),
    borderRadius: 14,
    borderWidth: 1,
    gap: ms(10),
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tierTag: {
    fontSize: fs(10),
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  eloText: {
    fontSize: fs(14),
    fontFamily: fonts.mono.semibold,
    marginTop: 2,
  },
  eloSub: {
    fontSize: fs(11),
    fontFamily: fonts.body.medium,
  },
  ratePill: {
    paddingHorizontal: ms(10),
    paddingVertical: ms(5),
    borderRadius: 999,
    backgroundColor: '#F0FDF4',
  },
  ratePillText: {
    fontSize: fs(10.5),
    fontFamily: fonts.mono.semibold,
    color: '#15803D',
  },
  track: {
    height: ms(8),
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  divisionsGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
    minHeight: 52,
    gap: 8,
  },
  divName: {
    fontSize: fs(12),
    fontFamily: fonts.body.semibold,
  },
  divRange: {
    fontSize: fs(11),
    fontFamily: fonts.mono.medium,
    marginTop: 2,
  },
  divReward: {
    fontSize: fs(10.5),
    fontFamily: fonts.mono.semibold,
  },
});
