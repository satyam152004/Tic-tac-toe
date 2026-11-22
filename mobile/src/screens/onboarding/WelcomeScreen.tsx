import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import { signInWithApple, signInWithGoogle } from '../../services/socialAuth';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

const appLogo = require('../../assets/images/app-logo.png');

type Action = 'google' | 'apple' | 'guest';

/* ── Google Multi-Color Brand SVG ── */
const GoogleIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </Svg>
);

/* ── Apple Brand SVG ── */
const AppleIcon: React.FC<{ size?: number; color: string }> = ({ size = 16, color }) => (
  <Svg width={size} height={size} viewBox="0 0 170 170" fill={color}>
    <Path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.77-11.65-14.19-5.77-9.15-10.34-19.46-13.72-30.93-3.38-11.48-5.07-22.42-5.07-32.81 0-14.04 3.46-25.96 10.37-35.77 6.92-9.8 15.7-14.86 26.35-15.17 4.36 0 9.29 1.15 14.8 3.44 5.51 2.29 9.38 3.51 11.61 3.66 1.83-.24 5.75-1.52 11.75-3.86 6-2.33 11.03-3.32 15.09-2.96 11.54.91 20.89 5.37 28.05 13.38-10.02 6.09-14.91 14.73-14.67 25.93.24 8.79 3.57 16.14 10 22.06 6.43 5.91 13.97 9.26 22.61 10.05-2.17 6.54-4.89 13.3-8.16 20.28zM119.22 33.7c0-7.39 2.6-14.17 7.8-20.35 5.2-6.18 11.65-10.06 19.35-11.65.24 1.48.36 2.89.36 4.23 0 7.39-2.73 14.3-8.2 20.73-5.46 6.42-12.06 10.22-19.8 11.41-.12-1.48-.19-2.94-.19-4.37z" />
  </Svg>
);

export const WelcomeScreen: React.FC<RootScreenProps<'welcome'>> = () => {
  const c = useTheme();
  const { nav, resetTo } = useAppNav();
  const { height: screenH } = useWindowDimensions();
  const [busy, setBusy] = useState<Action | null>(null);

  // Responsive device thresholds
  const isTall = screenH >= 800;
  const isCompact = screenH < 700;

  // Responsive metrics for perfect visual balance
  const cardSize = isTall ? 72 : isCompact ? 56 : 64;
  const cardRadius = isTall ? 20 : isCompact ? 16 : 18;
  const titleSize = isTall ? 26 : isCompact ? 22 : 24;
  const titleLineH = isTall ? 34 : isCompact ? 28 : 31;
  const subtitleSize = isTall ? 14 : isCompact ? 12.5 : 13.5;
  const subtitleLineH = isTall ? 21 : isCompact ? 18 : 19.5;
  const heroTopMargin = isTall ? Math.round(screenH * 0.08) : Math.round(screenH * 0.04);
  const actionsGap = isTall ? 12 : 10;
  const socialBtnHeight = isTall ? 44 : 40;

  const run = async (action: Action, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(action);
    try {
      await fn();
      resetTo('Main');
    } catch (e) {
      if (!(e instanceof Error && e.message === 'CANCELLED')) {
        toast.error('Sign-in failed', friendlyMessage(e));
      }
      setBusy(null);
    }
  };

  return (
    <Screen testID="welcome-screen" scroll={false} contentStyle={styles.screenContent}>
      {/* Top Hero Section */}
      <View style={[styles.hero, { marginTop: heroTopMargin }]}>
        <View
          style={[
            styles.markCard,
            {
              width: cardSize,
              height: cardSize,
              borderRadius: cardRadius,
              backgroundColor: c.bgCard,
              borderColor: c.border,
            },
          ]}
        >
          <Image
            source={appLogo}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>

        <Text
          style={[
            styles.title,
            {
              color: c.text,
              fontSize: titleSize,
              lineHeight: titleLineH,
            },
          ]}
        >
          Ready to Play?
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: c.textSecondary,
              fontSize: subtitleSize,
              lineHeight: subtitleLineH,
              maxWidth: isTall ? 280 : 250,
            },
          ]}
        >
          Sync your ELO rating, match history, and friends across devices.
        </Text>
      </View>

      {/* Bottom Actions Section */}
      <View style={[styles.actions, { gap: actionsGap }]}>
        <AppButton
          testID="welcome-register"
          title="Create Account"
          size={isTall ? 'lg' : 'md'}
          fullWidth
          disabled={!!busy}
          onPress={() => nav.navigate('registration')}
        />

        <AppButton
          testID="welcome-email"
          title="Sign In"
          variant="secondary"
          size={isTall ? 'lg' : 'md'}
          fullWidth
          disabled={!!busy}
          onPress={() => nav.navigate('login')}
        />

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: c.border }]} />
          <Text style={[styles.dividerText, { color: '#8E939E' }]}>or continue with</Text>
          <View style={[styles.line, { backgroundColor: c.border }]} />
        </View>

        {/* Social Buttons Row (Google & Apple side-by-side) */}
        <View style={styles.socialRow}>
          <Pressy
            testID="welcome-google"
            accessibilityLabel="Google"
            disabled={!!busy}
            onPress={() => run('google', signInWithGoogle)}
            style={[
              styles.socialBtn,
              {
                height: socialBtnHeight,
                backgroundColor: c.bgCard,
                borderColor: c.border,
              },
            ]}
          >
            {busy === 'google' ? (
              <ActivityIndicator size="small" color={c.text} />
            ) : (
              <View style={styles.socialInner}>
                <GoogleIcon size={16} />
                <Text style={[styles.socialBtnText, { color: c.text }]}>Google</Text>
              </View>
            )}
          </Pressy>

          <Pressy
            testID="welcome-apple"
            accessibilityLabel="Apple"
            disabled={!!busy}
            onPress={() => run('apple', signInWithApple)}
            style={[
              styles.socialBtn,
              {
                height: socialBtnHeight,
                backgroundColor: c.bgCard,
                borderColor: c.border,
              },
            ]}
          >
            {busy === 'apple' ? (
              <ActivityIndicator size="small" color={c.text} />
            ) : (
              <View style={styles.socialInner}>
                <AppleIcon size={16} color={c.text} />
                <Text style={[styles.socialBtnText, { color: c.text }]}>Apple</Text>
              </View>
            )}
          </Pressy>
        </View>

        {/* Continue as Guest */}
        <Pressy
          testID="welcome-guest"
          accessibilityLabel="Continue as Guest"
          disabled={!!busy}
          onPress={() => run('guest', () => useAuthStore.getState().continueAsGuest())}
          style={[styles.guestBtn, { minHeight: isTall ? 42 : 36 }]}
        >
          {busy === 'guest' ? (
            <ActivityIndicator size="small" color={c.textSecondary} />
          ) : (
            <Text
              style={[
                styles.guestBtnText,
                {
                  color: c.textSecondary,
                  fontSize: isTall ? 13 : 12,
                },
              ]}
            >
              Continue as Guest
            </Text>
          )}
        </Pressy>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  hero: {
    alignItems: 'center',
    textAlign: 'center',
  },
  markCard: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#141518',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: fonts.body.semibold,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    paddingTop: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontFamily: fonts.body.medium,
    fontSize: 11,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#141518',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  socialInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  socialBtnText: {
    fontFamily: fonts.body.semibold,
    fontSize: 13,
  },
  guestBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  guestBtnText: {
    fontFamily: fonts.body.medium,
  },
});
