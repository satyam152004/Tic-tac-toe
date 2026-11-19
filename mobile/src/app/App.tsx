import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppToastHost } from '../components/feedback/AppToast';
import { NetworkStatus } from '../components/feedback/NetworkStatus';
import { FONT_ASSETS } from '../design-system/fonts';
import { THEME_LIST } from '../design-system/themes';
import { useTheme } from '../hooks/useTheme';
import { navigationRef } from '../navigation/navigationRef';
import { RootNavigator } from '../navigation/RootNavigator';
import { flushPendingLink } from '../services/deepLinks';
import { queryClient } from '../services/queryClient';
import { useSettingsStore } from '../store/settingsStore';
import { useAppLifecycle } from './useAppLifecycle';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Shell() {
  const c = useTheme();
  const themeId = useSettingsStore((s) => s.theme);
  useAppLifecycle();

  const navTheme: Theme = useMemo(() => {
    const light = THEME_LIST.find((t) => t.id === themeId)?.isLight ?? false;
    const base = light ? DefaultTheme : DarkTheme;
    return { ...base, dark: !light, colors: { ...base.colors, primary: c.accent, background: c.bgPrimary, card: c.bgSecondary, text: c.text, border: c.border, notification: c.danger } };
  }, [c, themeId]);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onStateChange={flushPendingLink} onReady={flushPendingLink}>
      <RootNavigator />
      <NetworkStatus />
      <AppToastHost />
    </NavigationContainer>
  );
}

export default function App() {
  // A font that fails to load must not leave the app on a blank splash: fall back to the system font instead.
  const [loaded, fontError] = useFonts(FONT_ASSETS);
  const fontsLoaded = loaded || !!fontError;

  const onLayout = useCallback(() => {
    if (fontsLoaded) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Shell />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
