import { ch, fs } from '../../design-system/responsive';
import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from '../common/Pressy';

/**
 * The UI kit's flat action buttons (`ui-btn-primary / secondary / danger`): 10px radius, 13px / 600 label, 41px high.
 * `compact` is the 36px / 12px label variant used for secondary pairs; `tall` is the 40px lobby variant.
 */
export const ActionButton: React.FC<{
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  compact?: boolean;
  tall?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ title, onPress, variant = 'primary', compact, tall, fullWidth = false, icon, disabled, loading, style, testID }) => {
  const c = useTheme();
  const off = disabled || loading;
  const p = {
    primary: { text: c.onAccent, bg: c.accentFill, border: undefined },
    secondary: { text: c.text, bg: c.bgCard, border: c.border },
    danger: { text: c.dangerText, bg: c.dangerSoft, border: c.dangerBorder },
  }[variant];
  const box: ViewStyle = {
    minHeight: ch(compact ? 36 : tall ? 40 : 41),
    borderRadius: 12,
    paddingHorizontal: 16,
    alignSelf: fullWidth ? 'stretch' : 'auto',
    opacity: off ? 0.45 : 1,
    backgroundColor: p.bg,
    borderWidth: p.border ? 1 : 0,
    borderColor: p.border,
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
        {loading ? <ActivityIndicator color={p.text} size="small" /> : icon}
        <Text numberOfLines={1} style={{ fontFamily: fonts.body.semibold, fontSize: fs(compact ? 12 : 13), color: p.text }}>{title}</Text>
      </View>
    </Pressy>
  );
};

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
