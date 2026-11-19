import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
const appLogo = require('../../assets/images/app-logo.png');
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';

export const SPLASH_MIN_MS = 1400;

export const SplashScreen: React.FC<RootScreenProps<'splash'>> = () => {
  const c = useTheme();
  const { resetTo } = useAppNav();
  const status = useAuthStore((s) => s.status);
  const [minDone, setMinDone] = useState(false);
  const done = useRef(false);
  const progress = useSharedValue(0);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as `${number}%` }));

  useEffect(() => {
    void useAuthStore.getState().bootstrap();
    progress.value = withTiming(1, { duration: SPLASH_MIN_MS, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => setMinDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, [progress]);

  useEffect(() => {
    if (!minDone || status === 'booting' || done.current) return;
    done.current = true;
    if (status === 'signedIn') resetTo('Main');
    else resetTo(useSettingsStore.getState().onboardingSeen ? 'welcome' : 'onboarding_1');
  }, [minDone, status, resetTo]);

  return (
    <View style={[styles.root, { backgroundColor: c.bgPrimary }]} testID="splash-screen">
      <View />
      <View style={styles.center}>
        <View style={[styles.logo, { backgroundColor: c.bgCard, borderColor: c.accent }]}>
          <Image source={appLogo} style={{ width: '100%', height: '100%' }} />
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={[styles.title, { color: c.text }]}>Tic Tac Toe</Text>
          <Text style={[type.body, { color: c.textSecondary }]}>Strategic Offline & Online Arena</Text>
        </View>
      </View>
      <View style={styles.footer} accessibilityRole="progressbar" accessibilityLabel="Preparing Arena">
        <Text style={[type.subheading, { color: c.text }]}>Preparing Arena</Text>
        <Text style={[type.small, { color: c.textSecondary }]}>Syncing boards & rankings</Text>
        <View style={[styles.track, { backgroundColor: c.bgCard }]}>
          <Animated.View style={[styles.fill, { backgroundColor: c.accent }, bar]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 64 },
  center: { alignItems: 'center', gap: 24 },
  logo: { width: 112, height: 112, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  title: { fontFamily: fonts.body.semibold, fontSize: 30, lineHeight: 38 },
  footer: { width: '100%', alignItems: 'center', gap: 6 },
  track: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', borderRadius: 3 },
});
