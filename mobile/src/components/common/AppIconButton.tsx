import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from './Pressy';

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
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCard, borderColor: c.border, opacity: disabled ? 0.45 : 1 }, style]}
    >
      {icon}
    </Pressy>
  );
};
