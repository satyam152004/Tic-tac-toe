import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius } from '../../design-system/radius';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from './Pressy';

export interface AppCardProps {
  children: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  padding?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const PAD = { sm: 12, md: 16, lg: 20 } as const;

export const AppCard: React.FC<AppCardProps> = ({ children, selected, onPress, padding = 'md', style, testID, accessibilityLabel }) => {
  const c = useTheme();
  const box: ViewStyle = {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: PAD[padding],
    borderColor: selected ? c.accent : c.border,
    backgroundColor: selected ? c.bgCard : c.bgCard,
    overflow: 'hidden',
  };
  const inner = (
    <>
      {selected ? (
        <LinearGradient
          colors={[c.accent + '33', c.accentSecondary + '26']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      {children}
    </>
  );
  if (onPress) {
    return (
      <Pressy testID={testID} accessibilityLabel={accessibilityLabel} onPress={onPress} scaleTo={0.99} style={[box, style]}>
        {inner}
      </Pressy>
    );
  }
  return (
    <View testID={testID} style={[box, style]}>
      {inner}
    </View>
  );
};
