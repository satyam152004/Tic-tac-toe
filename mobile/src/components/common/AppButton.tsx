import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius } from '../../design-system/radius';
import { glow } from '../../design-system/shadows';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from './Pressy';

export interface AppButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title, onPress, variant = 'primary', size = 'lg', fullWidth = false, icon, disabled, loading, style, testID,
}) => {
  const c = useTheme();
  const height = size === 'lg' ? 52 : 44;
  const off = disabled || loading;

  const base: ViewStyle = { minHeight: height, borderRadius: radius.lg, paddingHorizontal: size === 'lg' ? 20 : 16, alignSelf: fullWidth ? 'stretch' : 'auto', opacity: off ? 0.45 : 1 };
  const palette = {
    primary: { text: '#FFFFFF', bg: undefined, border: undefined },
    secondary: { text: c.text, bg: c.bgElevated, border: c.border },
    outline: { text: c.text, bg: 'transparent', border: c.border },
    ghost: { text: c.textSecondary, bg: 'transparent', border: undefined },
    danger: { text: '#F87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)' },
  }[variant];

  const content = (
    <View style={styles.row}>
      {loading ? <ActivityIndicator color={palette.text} size="small" /> : icon}
      <Text style={[type.button, { color: palette.text, fontSize: size === 'lg' ? 15 : 14 }]} numberOfLines={1}>{title}</Text>
    </View>
  );

  return (
    <Pressy
      testID={testID}
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={[variant === 'primary' ? [base, glow(c.accent, 0.25)] : [base, { backgroundColor: palette.bg, borderWidth: palette.border ? 1 : 0, borderColor: palette.border }], style]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={[c.accent, c.accentSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />
      ) : null}
      <View style={styles.center}>{content}</View>
    </Pressy>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  center: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
