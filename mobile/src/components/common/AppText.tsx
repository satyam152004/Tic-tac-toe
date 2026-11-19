import React from 'react';
import { Text, TextProps } from 'react-native';
import { TypeVariant, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';

type Tone = 'primary' | 'secondary' | 'accent' | 'danger' | 'success' | 'warning' | 'onAccent';

/**
 * Themed text that takes a variant from the type scale. Prefer this over a bare `<Text style={{ fontSize ... }}>`:
 * size, weight, line height and colour then always come from the design system.
 */
export const AppText: React.FC<TextProps & { variant?: TypeVariant; tone?: Tone; center?: boolean }> = ({
  variant = 'body', tone = 'primary', center, style, ...rest
}) => {
  const c = useTheme();
  const color = { primary: c.text, secondary: c.textSecondary, accent: c.accent, danger: c.dangerText, success: c.success, warning: c.warning, onAccent: c.onAccent }[tone];
  return <Text {...rest} style={[type[variant], { color }, center && { textAlign: 'center' }, style]} />;
};
