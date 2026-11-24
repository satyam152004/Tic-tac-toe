import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppModal } from '../common/AppModal';
import { fonts } from '../../design-system/typography';
import { fs, ms } from '../../design-system/responsive';
import { useTheme } from '../../hooks/useTheme';
import { LEAGUE_DIVISIONS, divisionForPoints } from '../../services/leagues';

interface Props {
  open: boolean;
  onClose: () => void;
  points: number;
  /** Global rank, or null when unranked. */
  rank: number | null;
  /** Win % over the last 20 finished games, or null when there are none. */
  last20Pct: number | null;
}

/** Ranked Leagues details, shown in a popup from the leaderboard's "Your Rank" bar. */
export const RankedLeaguesSheet: React.FC<Props> = ({ open, onClose, points, rank, last20Pct }) => {
  const c = useTheme();
  const current = divisionForPoints(points);
  const curIdx = LEAGUE_DIVISIONS.findIndex((d) => d.name === current.name);
  const next = curIdx > 0 ? LEAGUE_DIVISIONS[curIdx - 1] : null;
  const progress = next ? Math.min(1, Math.max(0, (points - current.min) / (next.min - current.min))) : 1;
  const statusFor = (i: number) => (i === curIdx ? 'Your league' : i < curIdx ? 'Locked' : 'Completed');

  return (
    <AppModal open={open} title="Ranked Leagues" onClose={onClose}>
      <View style={styles.stack}>
        <View style={[styles.hero, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Text style={[styles.tierTag, { color: c.accent }]}>
                {current.name.toUpperCase()}
                {rank != null ? ` • RANK #${rank}` : ''}
              </Text>
              <Text style={[styles.points, { color: c.text }]}>
                {points.toLocaleString()} pts
                {next ? <Text style={[styles.toNext, { color: c.textSecondary }]}>{`  (${(next.min - points).toLocaleString()} to ${next.name})`}</Text> : null}
              </Text>
            </View>
            {last20Pct != null ? (
              <View style={styles.ratePill}>
                <Text style={styles.ratePillText}>{last20Pct}% Last 20</Text>
              </View>
            ) : null}
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
            style={[styles.track, { backgroundColor: c.bgSecondary }]}
          >
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: c.accent }]} />
          </View>
        </View>

        <View style={[styles.ladder, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {LEAGUE_DIVISIONS.map((div, i) => {
            const isCurrent = i === curIdx;
            const status = statusFor(i);
            return (
              <View key={div.name} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }, isCurrent && { backgroundColor: c.bgSecondary }]}>
                <View style={styles.rowText}>
                  <Text style={[styles.divName, { color: isCurrent ? c.accent : c.text }]}>{div.name}</Text>
                  <Text style={[styles.divRange, { color: c.textSecondary }]}>{div.range}</Text>
                </View>
                <Text style={[styles.divStatus, { color: isCurrent ? c.accent : c.textSecondary }]}>{status}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  stack: { gap: ms(12) },
  hero: { padding: ms(14), borderRadius: 14, borderWidth: 1, gap: ms(10) },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroText: { flexShrink: 1, minWidth: 0 },
  tierTag: { fontSize: fs(11), fontFamily: fonts.body.semibold, letterSpacing: 0.8 },
  points: { fontSize: fs(14), fontFamily: fonts.mono.semibold, marginTop: 2 },
  toNext: { fontSize: fs(11), fontFamily: fonts.body.medium },
  ratePill: { paddingHorizontal: ms(10), paddingVertical: ms(5), borderRadius: 999, backgroundColor: '#F0FDF4' },
  ratePillText: { fontSize: fs(11), fontFamily: fonts.mono.semibold, color: '#15803D' },
  track: { height: ms(8), borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  ladder: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: ms(14), paddingVertical: ms(10), minHeight: 52, gap: 8 },
  rowText: { flexShrink: 1, minWidth: 0 },
  divName: { fontSize: fs(12), fontFamily: fonts.body.semibold },
  divRange: { fontSize: fs(11), fontFamily: fonts.mono.medium, marginTop: 2 },
  divStatus: { fontSize: fs(11), fontFamily: fonts.mono.semibold },
});
