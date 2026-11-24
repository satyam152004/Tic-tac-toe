import React from 'react';
import {
  Text,
  TextProps,
  StyleProp,
  TextStyle,
} from 'react-native';

import { MAX_FONT_SIZE_MULTIPLIER } from '../../design-system/responsive';
import {
  TypeVariant,
  type,
} from '../../design-system/typography';

import { useTheme } from '../../hooks/useTheme';

type Tone =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'danger'
  | 'success'
  | 'warning'
  | 'onAccent';

interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}

export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  tone = 'primary',
  center = false,
  allowFontScaling = true,
  maxFontSizeMultiplier = MAX_FONT_SIZE_MULTIPLIER,
  style,
  ...rest
}) => {
  const c = useTheme();

  const color = {
    primary: c.text,
    secondary: c.textSecondary,
    accent: c.accent,
    danger: c.dangerText,
    success: c.success,
    warning: c.warning,
    onAccent: c.onAccent,
  }[tone];

  return (
    <Text
      {...rest}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        type[variant],
        { color },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
};