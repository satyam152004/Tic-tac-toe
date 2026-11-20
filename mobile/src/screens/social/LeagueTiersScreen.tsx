import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { withAlpha } from '../../design-system/colors';
import { fonts, type } from '../../design-system/typography';
import { useMe } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import type { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';

export interface DivisionInfo {
  name: string;
  min: number;
  max: number;
  reward: string;
}

export const LEAGUE_DIVISIONS: DivisionInfo[] = [
  { name: 'Platinum', min: 1700, max: 3000, reward: '+350 Coins' },
  { name: 'Gold I', min: 1500, max: 1699, reward: '+250 Coins' },
  { name: 'Gold II', min: 1400, max: 1499, reward: '+150 Coins' },
  { name: 'Silver', min: 1200, max: 1399, reward: '+100 Coins' },
  { name: 'Bronze', min: 0, max: 1199, reward: '+50 Coins' },
];

export function divisionForPoints(points: number): DivisionInfo {
  return LEAGUE_DIVISIONS.find((d) => points >= d.min) ?? LEAGUE_DIVISIONS[LEAGUE_DIVISIONS.length - 1]!;
}

export const LeagueTiersScreen: React.FC<RootScreenProps<'league_tiers'>> = () => {
  const c = useTheme();
  const { back } = useAppNav();
  const me = useMe();
  const points = me.data?.stats.points ?? 1200;
  const winRate = Math.round(me.data?.stats.winPercentage ?? 0);
  const current = divisionForPoints(points);
  const idx = LEAGUE_DIVISIONS.findIndex((d) => d.name === current.name);
  const nextDiv = idx > 0 ? LEAGUE_DIVISIONS[idx - 1] : null;
  const pct = nextDiv ? Math.max(0.08, Math.min(1, (points - current.min) / Math.max(1, nextDiv.min - current.min))) : 1;

  return (
    <Screen title="Ranked Leagues" subtitle="Season Standings" onBack={back} testID="league-tiers-screen">
      <AppCard selected style={{ gap: 12 }}>
        <View style={styles.between}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: withAlpha(c.accent, 0.14) }]}>
              <Trophy size={20} color={c.accent} />
            </View>
            <View>
              <Text style={[type.caption, { color: c.accent }]}>CURRENT DIVISION</Text>
              <Text style={[type.headline, { color: c.text }]}>{current.name}</Text>
            </View>
          </View>
          <View style={[styles.rateBadge, { backgroundColor: withAlpha(c.success, 0.14) }]}>
            <Text style={[type.caption, { color: c.success, fontFamily: fonts.mono.medium }]}>{winRate}% Win Rate</Text>
          </View>
        </View>

        <Text style={[type.num, { color: c.text }]}>
          {points} ELO {nextDiv ? `· ${Math.max(0, nextDiv.min - points)} pts to ${nextDiv.name}` : '· Top Division'}
        </Text>
        <View style={[styles.track, { backgroundColor: c.bgSecondary }]}>
          <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: c.accent, borderRadius: 4 }} />
        </View>
      </AppCard>

      <View style={{ gap: 10 }}>
        {LEAGUE_DIVISIONS.map((div) => {
          const isCurrent = div.name === current.name;
          return (
            <AppCard key={div.name} selected={isCurrent} padding="sm" style={styles.between}>
              <View>
                <Text style={[type.bodyStrong, { color: isCurrent ? c.accent : c.text }]}>{div.name}</Text>
                <Text style={[type.caption, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>
                  {div.max >= 3000 ? `${div.min}+ ELO` : `${div.min} – ${div.max} ELO`}
                </Text>
              </View>
              <Text style={[type.smallStrong, { color: isCurrent ? c.accent : c.textSecondary }]}>
                {isCurrent ? 'Current Division' : div.reward}
              </Text>
            </AppCard>
          );
        })}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
