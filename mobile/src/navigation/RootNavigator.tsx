import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { authScreens } from './AuthNavigator';
import { gameScreens } from './GameNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { onlineScreens } from './OnlineNavigator';
import { profileScreens } from './ProfileNavigator';
import { settingsScreens } from './SettingsNavigator';
import { Stack } from './stack';

/**
 * Root stack: `splash` decides where to go (signed in -> Main, else onboarding/welcome). All feature screens live in
 * one flat stack so route params are fully typed and navigate() de-duplicates repeated taps.
 */
export function RootNavigator() {
  const c = useTheme();
  return (
    <Stack.Navigator
      initialRouteName="splash"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bgPrimary }, animation: 'slide_from_right' }}
    >
      {authScreens()}
      <Stack.Screen name="Main" component={MainTabNavigator} options={{ gestureEnabled: false, animation: 'fade' }} />
      {gameScreens()}
      {onlineScreens()}
      {profileScreens()}
      {settingsScreens()}
    </Stack.Navigator>
  );
}
