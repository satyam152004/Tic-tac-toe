import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { BrandMark, MUTED } from '../auth/protoUi';

import { fs, ms } from '../../design-system/responsive';
export const SPLASH_MIN_MS = 1400;

export const SplashScreen: React.FC<RootScreenProps<'splash'>> = () => {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { resetTo } = useAppNav();
  const status = useAuthStore((s) => s.status);
  const [minDone, setMinDone] = useState(false);
  const done = useRef(false);
  const progress = useSharedValue(0);
  // The bar fills to the prototype's 2/3 while the session restores, then completes once routing is decided.
  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as `${number}%` }));

  useEffect(() => {
    void useAuthStore.getState().bootstrap();
    progress.value = withTiming(0.66, { duration: SPLASH_MIN_MS, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => setMinDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, [progress]);

  useEffect(() => {
    if (!minDone || status === 'booting' || done.current) return;
    done.current = true;
    progress.value = withTiming(1, { duration: 120 });
    if (status === 'signedIn') resetTo('Main');
    else resetTo(useSettingsStore.getState().onboardingSeen ? 'welcome' : 'onboarding_1');
  }, [minDone, status, resetTo, progress]);

  return (
    <View
      style={[styles.root, { backgroundColor: c.bgPrimary, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 14) }]}
      testID="splash-screen"
    >
      <View style={styles.center}>
        <View style={[styles.logo, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <BrandMark size={ms(40)} />
        </View>
        <Text style={[styles.title, { color: c.text }]}>Tic-Tac-Toe</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>Play 3×3, 4×4 and 5×5</Text>
      </View>
      <View style={styles.footer} accessibilityRole="progressbar" accessibilityLabel="Loading...">
        <View style={[styles.track, { backgroundColor: c.border }]}>
          <Animated.View style={[styles.fill, { backgroundColor: c.accent }, bar]} />
        </View>
        <Text style={[styles.loadingText, { color: MUTED }]}>Loading...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: ms(76),
    height: ms(76),
    borderRadius: ms(20),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#141518',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  title: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(22),
    lineHeight: Math.round(fs(22) * 1.27),
    letterSpacing: -0.44,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    fontSize: fs(13),
    lineHeight: Math.round(fs(13) * 1.3),
    marginTop: 4,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 40,
    paddingBottom: 10,
  },
  track: {
    width: ms(120),
    height: ms(5),
    borderRadius: 9999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 9999,
  },
  loadingText: {
    fontFamily: fonts.body.regular,
    fontSize: fs(10.5),
    lineHeight: Math.round(fs(10.5) * 1.3),
  },
});
