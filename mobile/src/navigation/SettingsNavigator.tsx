import React from 'react';
import { NotificationsScreen } from '../screens/settings/NotificationsScreen';
import { PrivacySettingsScreen } from '../screens/settings/PrivacySettingsScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ThemeSelectionScreen } from '../screens/settings/ThemeSelectionScreen';
import { Stack } from './stack';

export const settingsScreens = () => (
  <Stack.Group key="settings">
    <Stack.Screen name="settings" component={SettingsScreen} />
    <Stack.Screen name="privacy_settings" component={PrivacySettingsScreen} />
    <Stack.Screen name="theme_selection" component={ThemeSelectionScreen} />
    <Stack.Screen name="notifications" component={NotificationsScreen} />
  </Stack.Group>
);
