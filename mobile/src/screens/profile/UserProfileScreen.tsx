import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CheckCircle2, ChevronRight, Edit2, MailWarning, UserPlus } from 'lucide-react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppIconButton } from '../../components/common/AppIconButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { fonts } from '../../design-system/typography';
import { withAlpha } from '../../design-system/colors';
import { useMe, useStreaks } from '../../hooks/queries';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import { authApi } from '../../services/api/authApi';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

import { ch, fs, ms } from '../../design-system/responsive';
export const UserProfileScreen: React.FC = () => {
  const c = useTheme();
  const { nav, goTab } = useAppNav();
  const me = useMe();
  const streaks = useStreaks();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [refreshing, setRefreshing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const user = me.data;

  const { height: screenH } = useWindowDimensions();
  const isTall = screenH >= 780;

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
        toast.info('Code already sent', 'Use the code we just emailed you');
        nav.navigate('otp_verification', { email: user.email, purpose: 'verify' });
      } else if (code === 'ALREADY_VERIFIED') {
        await refreshUser();
        toast.info('Already verified');
      } else {
        toast.error("Couldn't send the code", friendlyMessage(e));
      }
    } finally {
      setVerifying(false);
    }
  };

  if (!user) {
    const err = me.error ? toApiError(me.error) : null;
    return (
      <Screen title="Profile" tabs>
        {me.isError ? (
          <ErrorState
            offline={err?.code === 'NETWORK_ERROR'}
            message={err ? friendlyMessage(err) : "Couldn't load your profile. Try again."}
            onRetry={() => void me.refetch()}
          />
        ) : (
          <AppLoader label="Loading profile..." />
        )}
      </Screen>
    );
  }

  const s = user.stats;
  const winPct = s.totalGames > 0 ? Math.round((s.wins / s.totalGames) * 100) : Math.round(s.winPercentage ?? 0);
  const guest = user.accountType === 'GUEST';

  const menuItems = [
    { key: 'stats', label: 'Statistics', onPress: () => nav.navigate('game_statistics') },
    { key: 'ach', label: 'Achievements', onPress: () => nav.navigate('achievements') },
    { key: 'rewards', label: 'Daily Rewards', onPress: () => nav.navigate('daily_rewards') },
    { key: 'friends', label: 'Friends', onPress: () => goTab('FriendsTab') },
    { key: 'theme', label: 'Theme', onPress: () => nav.navigate('theme_selection') },
    { key: 'settings', label: 'Settings', onPress: () => nav.navigate('settings') },
  ];

  return (
    <Screen
      tabs
      title="Profile"
      rightAction={
        <AppIconButton
          testID="profile-edit"
          label="Edit profile"
          icon={<Edit2 size={ms(20)} color={c.text} />}
          onPress={() => nav.navigate('edit_profile')}
        />
      }
      scroll={false}
      padded={false}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingHorizontal: 20, gap: isTall ? 16 : 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
      >
        {/* User Card */}
        <View style={styles.userRow}>
          <AppAvatar avatarId={user.avatar} name={user.displayName} size="lg" />
          <View style={styles.userInfoCol}>
            <Text numberOfLines={1} style={[styles.displayName, { color: c.text, fontSize: fs(isTall ? 17 : 15.5), lineHeight: Math.round(fs(17) * 1.3) }]}>
              {user.displayName}
            </Text>
            <Text style={[styles.metaHandle, { color: c.textSecondary, fontSize: fs(12) }]}>
              @{user.username} • {s.points.toLocaleString()} pts
            </Text>
          </View>
        </View>

        {/* 3-Column Stats Card */}
        <View style={[styles.statsCard, { backgroundColor: c.bgCard, borderColor: c.border, paddingVertical: ms(isTall ? 14 : 11) }]}>
          <View style={styles.statCol}>
            <Text style={[styles.statVal, { color: c.text, fontSize: fs(isTall ? 15 : 14) }]}>
              {s.totalGames}
            </Text>
            <Text style={[styles.statLabel, { color: c.textSecondary, fontSize: fs(11) }]}>Played</Text>
          </View>

          <View style={[styles.statCol, styles.statBorder, { borderColor: c.border }]}>
            <Text style={[styles.statVal, { color: c.accent, fontSize: fs(isTall ? 15 : 14) }]}>
              {winPct}%
            </Text>
            <Text style={[styles.statLabel, { color: c.textSecondary, fontSize: fs(11) }]}>Win</Text>
          </View>

          <View style={styles.statCol}>
            <Text style={[styles.statVal, { color: c.text, fontSize: fs(isTall ? 15 : 14) }]}>
              {s.currentStreak}d
            </Text>
            <Text style={[styles.statLabel, { color: c.textSecondary, fontSize: fs(11) }]}>Streak</Text>
          </View>
        </View>

        {/* Guest Banner (if guest) */}
        {guest ? (
          <View testID="guest-banner" style={[styles.alertBanner, { backgroundColor: withAlpha(c.warning, 0.12), borderColor: withAlpha(c.warning, 0.3) }]}>
            <UserPlus size={ms(20)} color={c.warning} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.alertTitle, { color: c.text }]}>Guest Account</Text>
              <Text style={[styles.alertDesc, { color: c.textSecondary }]}>Add an email to keep your rank and stats.</Text>
            </View>
            <AppButton
              testID="guest-create-account"
              title="Upgrade"
              size="md"
              variant="secondary"
              onPress={() => nav.navigate('registration')}
            />
          </View>
        ) : null}

        {/* Email Verification Banner (if registered but unverified) */}
        {!guest && user.email ? (
          user.emailVerified ? (
            <View style={[styles.alertBanner, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <CheckCircle2 size={ms(20)} color="#15803D" />
              <Text style={[styles.alertDesc, { color: '#15803D', flex: 1 }]}>Email verified ({user.email})</Text>
            </View>
          ) : (
            <View style={[styles.alertBanner, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
              <MailWarning size={ms(20)} color="#B45309" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.alertTitle, { color: '#B45309' }]}>Verify Email</Text>
                <Text style={[styles.alertDesc, { color: c.textSecondary }]}>Confirm {user.email} to secure account.</Text>
              </View>
              <AppButton
                testID="verify-email"
                title="Verify"
                size="md"
                variant="secondary"
                loading={verifying}
                onPress={verifyEmail}
              />
            </View>
          )
        ) : null}

        {/* Grouped Profile Menu List */}
        <View style={[styles.groupCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {menuItems.map((item, index) => {
            const isLast = index === menuItems.length - 1;

            return (
              <React.Fragment key={item.key}>
                <Pressy
                  accessibilityLabel={item.label}
                  onPress={item.onPress}
                  style={[styles.menuRow, { minHeight: isTall ? ch(44) : 48 }]}
                >
                  <Text style={[styles.menuLabel, { color: c.text, fontSize: fs(isTall ? 13 : 12) }]}>{item.label}</Text>
                  <ChevronRight size={ms(18)} color="#8E939E" />
                </Pressy>
                {!isLast ? <View style={[styles.divider, { backgroundColor: c.border }]} /> : null}
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 6,
    paddingBottom: 28,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(14),
    paddingVertical: 2,
  },
  userInfoCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  displayName: {
    fontFamily: fonts.body.semibold,
    letterSpacing: -0.3,
  },
  metaHandle: {
    fontFamily: fonts.mono.medium,
  },
  statsCard: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  statVal: {
    fontFamily: fonts.mono.semibold,
  },
  statLabel: {
    fontFamily: fonts.body.regular,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: ms(12),
  },
  alertTitle: {
    fontSize: fs(12),
    fontFamily: fonts.body.semibold,
  },
  alertDesc: {
    fontSize: fs(11),
    fontFamily: fonts.body.regular,
  },
  groupCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuLabel: {
    fontFamily: fonts.body.medium,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 0,
  },
});
