import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
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
        <View style={[styles.logo, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Svg width={44} height={44} viewBox="0 0 28 28" fill="none">
            <Path d="M9.5 3.5V24.5M18.5 3.5V24.5M3.5 9.5H24.5M3.5 18.5H24.5" stroke={c.border} strokeWidth={1.6} strokeLinecap="round" />
            <Path d="M5.2 5.2L7.8 7.8M7.8 5.2L5.2 7.8" stroke={c.x} strokeWidth={2.2} strokeLinecap="round" />
            <Circle cx={14} cy={14} r={2.2} stroke={c.o} strokeWidth={2.2} />
            <Path d="M20.2 20.2L22.8 22.8M22.8 20.2L20.2 22.8" stroke={c.x} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={[styles.title, { color: c.text }]}>Tic Tac Toe</Text>
          <Text style={[type.body, { color: c.textSecondary }]}>Tactical 3×3, 4×4 &amp; 5×5</Text>
        </View>
      </View>
      <View style={styles.footer} accessibilityRole="progressbar" accessibilityLabel="Preparing Arena">
        <Text style={[type.subheading, { color: c.text }]}>Preparing Arena</Text>
        <Text style={[type.small, { color: c.textSecondary }]}>Syncing boards &amp; rankings</Text>
        <View style={[styles.track, { backgroundColor: c.border }]}>
          <Animated.View style={[styles.fill, { backgroundColor: c.accent }, bar]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 64 },
  center: { alignItems: 'center', gap: 20 },
  logo: { width: 84, height: 84, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.body.semibold, fontSize: 28, lineHeight: 34 },
  footer: { width: '100%', alignItems: 'center', gap: 6 },
  track: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', borderRadius: 3 },
});
