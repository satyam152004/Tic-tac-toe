import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { THEME_LIST } from '../../design-system/themes';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../hooks/useTheme';
import { AppHeader } from './AppHeader';

/**
 * Standard screen wrapper: themed background, safe areas, optional header, keyboard avoidance and scrolling.
 * Screens that live under a tab bar pass `tabs` so the bottom inset is not applied twice.
 */
export const Screen: React.FC<{
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  scroll?: boolean;
  tabs?: boolean;
  padded?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ title, subtitle, onBack, rightAction, scroll = true, tabs, padded = true, footer, children, contentStyle, testID }) => {
  const c = useTheme();
  const themeId = useSettingsStore((s) => s.theme);
  const insets = useSafeAreaInsets();
  const light = THEME_LIST.find((t) => t.id === themeId)?.isLight;
  const bottom = tabs ? 0 : insets.bottom;
  const body: ViewStyle = { padding: padded ? 20 : 0, paddingBottom: (padded ? 20 : 0) + (footer ? 0 : bottom), gap: 16 };

  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: c.bgPrimary, paddingTop: title ? 0 : insets.top }}>
      <StatusBar style={light ? 'dark' : 'light'} />
      {title ? <AppHeader title={title} subtitle={subtitle} onBack={onBack} rightAction={rightAction} /> : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[body, contentStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, body, contentStyle]}>{children}</View>
        )}
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 + bottom, gap: 10 }}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </View>
  );
};
