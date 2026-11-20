import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Award, BadgeCheck, BarChart3, ChevronRight, Coins, Crown, Edit3, Flame, Gift, History, MailWarning, Settings, Sparkles, UserPlus } from 'lucide-react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppIconButton } from '../../components/common/AppIconButton';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { ScoreCard } from '../../components/profile/Cards';
import { fonts, type } from '../../design-system/typography';
import { useMe, useStreaks } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import { authApi } from '../../services/api/authApi';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import type { Me } from '../../services/api/types';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

const FORM_COLOR = { WIN: 'success', LOSS: 'danger', DRAW: 'warning' } as const;
const FORM_LETTER = { WIN: 'W', LOSS: 'L', DRAW: 'D' } as const;

export const xpProgress = (s: Me['stats']): number => {
  const span = s.xpForNextLevel - s.xpForCurrentLevel;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (s.xp - s.xpForCurrentLevel) / span));
};

export const UserProfileScreen: React.FC = () => {
  const c = useTheme();
  const { nav } = useAppNav();
  const me = useMe();
  const streaks = useStreaks();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [refreshing, setRefreshing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const user = me.data;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([me.refetch(), streaks.refetch(), refreshUser()]);
    setRefreshing(false);
  }, [me, streaks, refreshUser]);

  const verifyEmail = async () => {
    if (!user?.email || verifying) return;
    setVerifying(true);
    try {
      await authApi.resendVerification();
      nav.navigate('otp_verification', { email: user.email, purpose: 'verify' });
    } catch (e) {
      const code = toApiError(e).code;
      if (code === 'OTP_COOLDOWN') {
        toast.info('Code already sent', 'Use the code we emailed a moment ago');
        nav.navigate('otp_verification', { email: user.email, purpose: 'verify' });
      } else if (code === 'ALREADY_VERIFIED') {
        await refreshUser();
        toast.info('Already verified');
      } else {
        toast.error('Could not send code', friendlyMessage(e));
      }
    } finally {
      setVerifying(false);
    }
  };

  const settingsBtn = <AppIconButton label="Settings" icon={<Settings size={20} color={c.textSecondary} />} onPress={() => nav.navigate('settings')} testID="profile-settings" />;

  if (!user) {
    const err = me.error ? toApiError(me.error) : null;
    return (
      <Screen title="Player Profile" tabs rightAction={settingsBtn}>
        {me.isError ? (
          <ErrorState offline={err?.code === 'NETWORK_ERROR'} message={err ? friendlyMessage(err) : 'Could not load your profile.'} onRetry={() => void me.refetch()} />
        ) : (
          <AppLoader label="Loading profile..." />
        )}
      </Screen>
    );
  }

  const s = user.stats;
  const winPct = s.totalGames > 0 ? Math.round((s.wins / s.totalGames) * 100) : Math.round(s.winPercentage ?? 0);
  const pct = xpProgress(s);
  const guest = user.accountType === 'GUEST';
  const offlineErr = me.isError && toApiError(me.error).code === 'NETWORK_ERROR';
  const form = streaks.data?.recentForm ?? [];

  const links: Array<{ key: string; label: string; icon: React.ReactNode; onPress: () => void }> = [
    { key: 'stats', label: 'Statistics', icon: <BarChart3 size={18} color={c.accent} />, onPress: () => nav.navigate('game_statistics') },
    { key: 'leagues', label: 'Ranked Leagues', icon: <Crown size={18} color={c.accent} />, onPress: () => nav.navigate('league_tiers') },
    { key: 'history', label: 'Match History', icon: <History size={18} color={c.accent} />, onPress: () => nav.navigate('offline_history') },
    { key: 'ach', label: 'Achievements', icon: <Award size={18} color={c.accent} />, onPress: () => nav.navigate('achievements') },
    { key: 'rewards', label: 'Daily Rewards', icon: <Gift size={18} color={c.accent} />, onPress: () => nav.navigate('daily_rewards') },
    { key: 'shop', label: 'Emblems & Shop', icon: <Sparkles size={18} color={c.accent} />, onPress: () => nav.navigate('coin_shop') },
  ];

  return (
    <Screen title="Player Profile" tabs scroll={false} padded={false} rightAction={settingsBtn} testID="profile-screen">
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.accent} />}
      >
        {offlineErr ? <ErrorState offline message="Showing your last saved profile. Pull down to retry." onRetry={() => void refresh()} /> : null}

        {guest ? (
          <AppCard testID="guest-banner" style={{ gap: 10, borderColor: c.accent }}>
            <View style={styles.row}>
              <UserPlus size={20} color={c.accent} />
              <Text style={[type.subheading, { color: c.text, flex: 1 }]}>You are playing as a guest</Text>
            </View>
            <Text style={[type.small, { color: c.textSecondary }]}>Create an account to keep your progress, play across devices and appear on the leaderboards.</Text>
            <AppButton testID="guest-create-account" title="Create account" size="md" onPress={() => nav.navigate('registration')} />
          </AppCard>
        ) : null}

        <AppCard style={{ gap: 16 }}>
          <View style={[styles.row, { gap: 14 }]}>
            <AppAvatar avatarId={user.avatar} name={user.displayName} size="xl" status="online" activeRing />
            <View style={{ flex: 1 }}>
              <Text style={[type.headline, { color: c.text, fontSize: 18 }]} numberOfLines={1} testID="profile-name">
                {user.displayName}
              </Text>
              <Text style={[type.small, { color: c.textSecondary }]} numberOfLines={1}>
                @{user.username}
              </Text>
              <Text style={[type.small, { color: c.textSecondary, fontFamily: fonts.mono.medium, marginTop: 2 }]}>
                Level {s.level} · {s.points} Rating
              </Text>
              {user.bio ? (
                <Text style={[type.small, { color: c.textSecondary, marginTop: 4 }]} numberOfLines={2}>
                  {user.bio}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text style={[type.caption, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>XP Progress</Text>
              <Text style={[type.caption, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>
                {s.xp} / {s.xpForNextLevel} XP
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: c.bgSecondary }]} accessibilityLabel={`Level progress ${Math.round(pct * 100)} percent`}>
              <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', borderRadius: 999, backgroundColor: c.accent }} />
            </View>
          </View>

          <View style={[styles.row, { gap: 6 }]}>
            <Coins size={16} color={c.warning} />
            <Text testID="profile-coins" style={[type.num, { color: c.text }]}>
              {user.wallet.coins}
            </Text>
            <Text style={[type.small, { color: c.textSecondary }]}>coins</Text>
          </View>
        </AppCard>

        <View style={styles.grid}>
          <View style={styles.cell}><ScoreCard label="Wins" value={s.wins} tone="success" /></View>
          <View style={styles.cell}><ScoreCard label="Win Percentage" value={`${winPct}%`} tone="accent" /></View>
          <View style={styles.cell}><ScoreCard label="Losses" value={s.losses} /></View>
          <View style={styles.cell}><ScoreCard label="Draws" value={s.draws} tone="warning" /></View>
        </View>

        <AppCard style={{ gap: 10 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={styles.row}>
              <Flame size={18} color={c.warning} />
              <Text style={[type.subheading, { color: c.text }]}>Streak</Text>
            </View>
            <Text style={[type.small, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>
              {s.currentStreak} current · {s.bestStreak} best
            </Text>
          </View>
          {form.length > 0 ? (
            <View style={[styles.row, { gap: 6 }]} testID="recent-form">
              <Text style={[type.caption, { color: c.textSecondary }]}>Recent form</Text>
              {form.map((r, i) => (
                <View key={i} accessibilityLabel={r === 'WIN' ? 'Win' : r === 'LOSS' ? 'Loss' : 'Draw'} style={[styles.chip, { backgroundColor: c[FORM_COLOR[r]] + '33', borderColor: c[FORM_COLOR[r]] }]}>
                  <Text style={[type.caption, { color: c[FORM_COLOR[r]], fontFamily: fonts.mono.semibold }]}>{FORM_LETTER[r]}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </AppCard>

        {!guest && user.email ? (
          <AppCard testID="email-status" style={[styles.row, { gap: 10 }]}>
            {user.emailVerified ? <BadgeCheck size={20} color={c.success} /> : <MailWarning size={20} color={c.warning} />}
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: c.text }]}>{user.emailVerified ? 'Email verified' : 'Email not verified'}</Text>
              <Text style={[type.small, { color: c.textSecondary }]} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            {!user.emailVerified ? <AppButton testID="verify-email" title="Verify email" size="md" variant="secondary" loading={verifying} onPress={() => void verifyEmail()} /> : null}
          </AppCard>
        ) : null}

        <View style={{ gap: 10 }}>
          <AppButton testID="profile-edit" title="Edit Profile" fullWidth variant="secondary" icon={<Edit3 size={16} color={c.text} />} onPress={() => nav.navigate('edit_profile')} />
          {links.map((l) => (
            <AppCard key={l.key} padding="sm" onPress={l.onPress} accessibilityLabel={l.label}>
              <View style={[styles.row, { gap: 12, minHeight: 32 }]}>
                {l.icon}
                <Text style={[type.bodyStrong, { color: c.text, flex: 1 }]}>{l.label}</Text>
                <ChevronRight size={18} color={c.textSecondary} />
              </View>
            </AppCard>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48%', flexGrow: 1 },
  chip: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
