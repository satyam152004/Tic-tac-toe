import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { radius } from '../../design-system/radius';
import { layout } from '../../design-system/spacing';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from './Pressy';

/** 44x44 square icon button (the minimum touch target). Pass an icon of `iconSize.md`. */
export const AppIconButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ icon, label, onPress, disabled, style, testID }) => {
  const c = useTheme();
  return (
    <Pressy
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[{ width: layout.minTouch, height: layout.minTouch, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCard, borderColor: c.border, opacity: disabled ? 0.45 : 1 }, style]}
    >
      {icon}
    </Pressy>
  );
};
