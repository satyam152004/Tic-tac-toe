import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
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

/** Flat card: `bgCard` surface, 1px border, `radius.lg`. A selected card swaps to the accent border and a raised surface. */
export const AppCard: React.FC<AppCardProps> = ({ children, selected, onPress, padding = 'md', style, testID, accessibilityLabel }) => {
  const c = useTheme();
  const box: ViewStyle = {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: PAD[padding],
    borderColor: selected ? c.accent : c.border,
    backgroundColor: selected ? c.bgElevated : c.bgCard,
    overflow: 'hidden',
  };
  if (onPress) {
    return (
      <Pressy testID={testID} accessibilityLabel={accessibilityLabel} accessibilityState={{ selected: !!selected }} onPress={onPress} scaleTo={0.99} style={[box, style]}>
        {children}
      </Pressy>
    );
  }
  return (
    <View testID={testID} style={[box, style]}>
      {children}
    </View>
  );
};
