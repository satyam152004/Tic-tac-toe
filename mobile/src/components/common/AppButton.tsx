import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { radius } from '../../design-system/radius';
import { layout } from '../../design-system/spacing';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from './Pressy';

export interface AppButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  /** md = 44 high (rows, dialogs, toolbars), lg = 52 high (the main action on a screen). */
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const HEIGHT = { md: layout.minTouch, lg: 52 } as const;

/** Flat, solid buttons. Variants differ by fill and border only; the label is always `type.button`. */
export const AppButton: React.FC<AppButtonProps> = ({
  title, onPress, variant = 'primary', size = 'lg', fullWidth = false, icon, disabled, loading, style, testID,
}) => {
  const c = useTheme();
  const off = disabled || loading;

  const palette = {
    primary: { text: c.onAccent, bg: c.accentFill, border: undefined },
    secondary: { text: c.text, bg: c.bgElevated, border: c.border },
    outline: { text: c.text, bg: 'transparent', border: c.border },
    ghost: { text: c.textSecondary, bg: 'transparent', border: undefined },
    danger: { text: c.dangerText, bg: c.dangerSoft, border: c.dangerBorder },
  }[variant];

  const box: ViewStyle = {
    minHeight: HEIGHT[size],
    borderRadius: radius.lg,
    paddingHorizontal: size === 'lg' ? 20 : 16,
    alignSelf: fullWidth ? 'stretch' : 'auto',
    opacity: off ? 0.45 : 1,
    backgroundColor: palette.bg,
    borderWidth: palette.border ? 1 : 0,
    borderColor: palette.border,
  };

  return (
    <Pressy
      testID={testID}
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={[box, style]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={palette.text} size="small" /> : icon}
        <Text style={[type.button, { color: palette.text }]} numberOfLines={1}>{title}</Text>
      </View>
    </Pressy>
  );
};

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
