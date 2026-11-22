import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/common/Screen';
import { fonts, type } from '../../design-system/typography';
import { useMe } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';

export interface DivisionInfo {
  name: string;
  min: number;
  max: number;
  range: string;
  reward: string;
}

export const LEAGUE_DIVISIONS: DivisionInfo[] = [
  { name: 'Platinum', min: 1700, max: 3000, range: '1,700+ ELO', reward: '+350 Coins' },
  { name: 'Gold I', min: 1500, max: 1699, range: '1,500 – 1,699 ELO', reward: '+250 Coins' },
  { name: 'Gold II', min: 1400, max: 1499, range: '1,400 – 1,499 ELO', reward: 'Current Division' },
  { name: 'Silver', min: 1200, max: 1399, range: '1,200 – 1,399 ELO', reward: 'Completed' },
  { name: 'Bronze', min: 0, max: 1199, range: 'Below 1,200 ELO', reward: 'Completed' },
];

export function divisionForPoints(points: number): DivisionInfo {
  return LEAGUE_DIVISIONS.find((d) => points >= d.min) ?? LEAGUE_DIVISIONS[LEAGUE_DIVISIONS.length - 1]!;
}

export const LeagueTiersScreen: React.FC<RootScreenProps<'league_tiers'>> = () => {
  const c = useTheme();
  const { back } = useAppNav();
  const me = useMe();
  const points = me.data?.stats.points ?? 1498;

  return (
    <Screen
      title="Ranked Leagues"
      onBack={back}
      testID="league-tiers-screen"
      rightAction={
        <Text style={[styles.headerSeason, { color: c.textSecondary }]}>Season 4</Text>
      }
    >
      <View style={{ gap: 14 }}>
        {/* Division Progress Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={[styles.tierTag, { color: c.accent }]}>GOLD II • RANK #14</Text>
              <Text style={[styles.eloText, { color: c.text }]}>
                {points.toLocaleString()} ELO{' '}
                <Text style={[styles.eloSub, { color: c.textSecondary }]}>
                  (2 to Gold I)
                </Text>
              </Text>
            </View>
            <View style={styles.ratePill}>
              <Text style={styles.ratePillText}>82% Last 20</Text>
            </View>
          </View>

          <View style={[styles.track, { backgroundColor: c.bgSecondary }]}>
            <View style={[styles.fill, { width: '98%', backgroundColor: c.accent }]} />
          </View>
        </View>

        {/* Divisions List */}
        <View style={[styles.divisionsGroup, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {LEAGUE_DIVISIONS.map((div, i) => {
            const isCurrent = div.name === 'Gold II';
            return (
              <View
                key={div.name}
                style={[
                  styles.divRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                  isCurrent && { backgroundColor: '#EFF4FF' },
                ]}
              >
                <View>
                  <Text
                    style={[
                      styles.divName,
                      { color: isCurrent ? c.accent : c.text },
                    ]}
                  >
                    {div.name}
                  </Text>
                  <Text style={[styles.divRange, { color: c.textSecondary }]}>{div.range}</Text>
                </View>

                <Text
                  style={[
                    styles.divReward,
                    {
                      color: isCurrent ? c.accent : c.textSecondary,
                      fontFamily: isCurrent ? fonts.body.semibold : fonts.body.medium,
                    },
                  ]}
                >
                  {div.reward}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerSeason: {
    fontSize: 11,
    fontFamily: fonts.body.semibold,
  },
  heroCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierTag: {
    fontSize: 10,
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  eloText: {
    fontSize: 15,
    fontFamily: fonts.mono.semibold,
    marginTop: 2,
  },
  eloSub: {
    fontSize: 11,
    fontFamily: fonts.body.medium,
  },
  ratePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#F0FDF4',
  },
  ratePillText: {
    fontSize: 10.5,
    fontFamily: fonts.mono.semibold,
    color: '#15803D',
  },
  track: {
    height: 6,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  divName: {
    fontSize: 13,
    fontFamily: fonts.body.semibold,
  },
  divRange: {
    fontSize: 10.5,
    fontFamily: fonts.mono.medium,
    marginTop: 2,
  },
  divReward: {
    fontSize: 11.5,
  },
});
