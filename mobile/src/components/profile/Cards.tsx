import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Award, Check, CheckCircle2, Coins, Lock } from 'lucide-react-native';
import { ThemeDefinition } from '../../design-system/themes';
import { THEME_COLORS, withAlpha } from '../../design-system/colors';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { AppAvatar } from '../common/AppAvatar';
import { AppCard } from '../common/AppCard';
import { Pressy } from '../common/Pressy';

/* ----------------------------- ScoreCard ----------------------------- */
export const ScoreCard: React.FC<{
  label: string;
  value: string | number;
  subtext?: string;
  tone?: 'default' | 'accent' | 'success' | 'warning';
}> = ({ label, value, subtext, tone = 'default' }) => {
  const c = useTheme();
  const color = { default: c.text, accent: c.accent, success: c.success, warning: c.warning }[tone];
  return (
    <View style={[styles.score, { backgroundColor: c.bgCard, borderColor: c.border }]} accessibilityLabel={`${label}: ${value}`}>
      <Text style={[type.numLarge, { color }]}>{value}</Text>
      <Text style={[type.smallStrong, { color: c.textSecondary, marginTop: 2 }]}>{label}</Text>
      {subtext ? <Text style={[type.caption, { color: c.textSecondary, marginTop: 2 }]}>{subtext}</Text> : null}
    </View>
  );
};

/* ---------------------------- GameModeCard --------------------------- */
export const GameModeCard: React.FC<{
  title: string;
  description: string;
  metaText?: string;
  icon: React.ReactNode;
  featured?: boolean;
  onPress: () => void;
  testID?: string;
}> = ({ title, description, metaText, icon, featured, onPress, testID }) => {
  const c = useTheme();
  return (
    <Pressy
      testID={testID}
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      scaleTo={0.99}
      style={[styles.mode, { borderColor: featured ? c.accent : c.border, backgroundColor: c.bgCard }]}
    >
      {featured ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(c.accent, 0.12) }]} /> : null}
      <View style={[styles.modeIcon, featured ? { backgroundColor: c.accent } : { backgroundColor: c.bgElevated, borderWidth: 1, borderColor: c.border }]}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[type.subheading, { color: c.text }]}>{title}</Text>
        <Text numberOfLines={2} style={[type.small, { color: c.textSecondary, marginTop: 2 }]}>{description}</Text>
        {metaText ? <Text style={[type.caption, { color: c.textSecondary, opacity: 0.8, marginTop: 4 }]}>{metaText}</Text> : null}
      </View>
    </Pressy>
  );
};

/* --------------------------- AchievementCard -------------------------- */
export interface AchievementView {
  id: string;
  title: string;
  description: string;
  category: string;
  progress: number;
  target: number;
  rewardLabel: string;
  unlocked: boolean;
}

export const AchievementCard: React.FC<{ achievement: AchievementView }> = ({ achievement: a }) => {
  const c = useTheme();
  const pct = Math.min(100, Math.round((a.progress / Math.max(1, a.target)) * 100));
  return (
    <AppCard selected={a.unlocked} style={{ gap: 10 }} accessibilityLabel={`${a.title}, ${a.unlocked ? 'unlocked' : `${pct} percent`}`}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={[styles.achIcon, a.unlocked ? { backgroundColor: c.success + '33', borderColor: withAlpha(c.success, 0.4) } : { backgroundColor: c.bgElevated, borderColor: c.border }]}>
          {a.unlocked ? <Award size={20} color={c.success} /> : <Lock size={20} color={c.textSecondary} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[type.subheading, { color: c.text }]}>{a.title}</Text>
          <Text style={[type.small, { color: c.textSecondary, marginTop: 2 }]}>{a.description}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-start' }}>
          <Coins size={14} color={c.warning} />
          <Text style={[type.num, { fontSize: 12, color: c.warning }]}>{a.rewardLabel}</Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[type.caption, { color: c.textSecondary }]}>{a.category} · {a.unlocked ? 'Unlocked' : 'In Progress'}</Text>
          <Text style={[type.caption, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>{Math.min(a.progress, a.target)}/{a.target}</Text>
        </View>
        <View style={[styles.track, { backgroundColor: c.bgSecondary }]}>
          <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: a.unlocked ? c.success : c.accent }} />
        </View>
      </View>
    </AppCard>
  );
};

/* --------------------------- LeaderboardItem -------------------------- */
export interface LeaderboardView {
  rank: number;
  id: string;
  username: string;
  avatarId?: string | null;
  wins: number;
  rating: number;
  winRate: number;
  isCurrentUser?: boolean;
}

export const LeaderboardItem: React.FC<{ entry: LeaderboardView; ratingLabel?: string; onPress?: () => void }> = ({ entry, ratingLabel = 'Points', onPress }) => {
  const c = useTheme();
  return (
    <AppCard selected={entry.isCurrentUser} padding="sm" onPress={onPress} style={styles.lbRow} accessibilityLabel={`Rank ${entry.rank}, ${entry.username}, ${entry.rating} ${ratingLabel}`}>
      <Text style={[type.num, { width: 36, color: entry.rank <= 3 ? c.warning : c.textSecondary }]}>#{entry.rank}</Text>
      <AppAvatar avatarId={entry.avatarId} name={entry.username} size="sm" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>{entry.username}{entry.isCurrentUser ? ' (You)' : ''}</Text>
        <Text style={[type.caption, { color: c.textSecondary }]}>{entry.wins} wins · {entry.winRate}% win rate</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[type.num, { color: c.accent }]}>{entry.rating}</Text>
        <Text style={[type.caption, { color: c.textSecondary, fontSize: 10 }]}>{ratingLabel}</Text>
      </View>
    </AppCard>
  );
};

/* ----------------------------- RewardCard ----------------------------- */
export interface RewardView {
  day: number;
  coins: number;
  bonusLabel?: string | null;
  status: 'claimed' | 'claimable' | 'locked';
}

export const RewardCard: React.FC<{ reward: RewardView; onClaim: (day: number) => void }> = ({ reward, onClaim }) => {
  const c = useTheme();
  const claimable = reward.status === 'claimable';
  const claimed = reward.status === 'claimed';
  return (
    <Pressy
      testID={`reward-day-${reward.day}`}
      accessibilityLabel={`Day ${reward.day}, ${reward.coins} coins, ${reward.status}`}
      disabled={!claimable}
      onPress={() => claimable && onClaim(reward.day)}
      scaleTo={0.95}
      style={[styles.reward, { borderColor: claimable ? c.accent : claimed ? withAlpha(c.success, 0.4) : c.border, backgroundColor: c.bgCard, opacity: claimable ? 1 : claimed ? 0.85 : 0.6 }]}
    >
      {claimable ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(c.accent, 0.16) }]} /> : null}
      <Text style={[type.caption, { color: c.textSecondary }]}>Day {reward.day}</Text>
      {claimed ? <CheckCircle2 size={24} color={c.success} /> : <Coins size={24} color={claimable ? c.warning : c.textSecondary} />}
      <View style={{ alignItems: 'center' }}>
        <Text style={[type.num, { fontSize: 13, color: c.text }]}>+{reward.coins}</Text>
        {reward.bonusLabel ? <Text style={[type.caption, { fontSize: 10, color: c.o }]}>{reward.bonusLabel}</Text> : null}
      </View>
    </Pressy>
  );
};

/* ------------------------------ ThemeCard ----------------------------- */
export const ThemeCard: React.FC<{ theme: ThemeDefinition; selected: boolean; onSelect: () => void }> = ({ theme, selected, onSelect }) => {
  const c = useTheme();
  const t = THEME_COLORS[theme.id];
  const marks: ('X' | 'O' | null)[] = ['X', 'O', null, null, 'X', 'O', null, null, 'X'];
  return (
    <AppCard selected={selected} onPress={onSelect} padding="sm" testID={`theme-${theme.id}`} accessibilityLabel={`${theme.name}${selected ? ', selected' : ''}`} style={{ gap: 10 }}>
      <View style={{ borderRadius: 12, padding: 10, borderWidth: 1, backgroundColor: t.bgPrimary, borderColor: selected ? t.accent : 'rgba(255,255,255,0.08)' }}>
        <View style={{ width: 84, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {marks.map((m, i) => (
            <View key={i} style={{ width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bgCard }}>
              {m ? <Text style={[type.caption, { color: m === 'X' ? t.x : t.o }]}>{m}</Text> : null}
            </View>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>{theme.name}</Text>
          <Text numberOfLines={1} style={[type.caption, { color: c.textSecondary }]}>{theme.subtitle}</Text>
        </View>
        {selected ? (
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.accentFill, alignItems: 'center', justifyContent: 'center' }}>
            <Check size={14} color={c.onAccent} />
          </View>
        ) : null}
      </View>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  score: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center' },
  mode: { borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' },
  modeIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  achIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reward: { flex: 1, minHeight: 104, borderRadius: 16, borderWidth: 1, padding: 10, alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' },
});
