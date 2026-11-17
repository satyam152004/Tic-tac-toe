import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SymbolMark } from '../../components/game/SymbolMark';
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
    <LinearGradient colors={[c.bgElevated, c.bgPrimary, c.bgPrimary]} style={styles.root} testID="splash-screen">
      <View />
      <View style={styles.center}>
        <View style={[styles.logo, { backgroundColor: c.bgCard, borderColor: c.accent + '80', shadowColor: c.accent }]}>
          <SymbolMark value="X" size="lg" />
          <SymbolMark value="O" size="lg" />
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
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 64 },
  center: { alignItems: 'center', gap: 24 },
  logo: { width: 112, height: 112, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  title: { fontFamily: fonts.display.extrabold, fontSize: 30, lineHeight: 36 },
  footer: { width: '100%', alignItems: 'center', gap: 6 },
  track: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', borderRadius: 3 },
});
