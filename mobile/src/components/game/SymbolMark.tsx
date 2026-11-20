import React, { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';

export type SymbolSize = 'sm' | 'md' | 'lg' | 'xl';
const DIM: Record<SymbolSize, number> = { sm: 16, md: 28, lg: 44, xl: 56 };

/** Crisp flat vector X / O glyphs from the Clean & Minimal UI Kit (48x48 viewBox, 5.5px round stroke). */
export const SymbolMark: React.FC<{ value: 'X' | 'O'; size?: SymbolSize | number; glow?: boolean; animate?: boolean }> = ({
  value, size = 'md', animate = true,
}) => {
  const c = useTheme();
  const d = typeof size === 'number' ? size : DIM[size];
  const color = value === 'X' ? c.x : c.o;
  const sc = useSharedValue(animate ? 0.65 : 1);
  const op = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    op.value = withTiming(1, { duration: 180 });
    sc.value = withSequence(withTiming(1.06, { duration: 130, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 50 }));
  }, [animate, op, sc]);
  const style = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));

  return (
    <Animated.View accessibilityLabel={value} style={[{ width: d, height: d }, style]}>
      <Svg width={d} height={d} viewBox="0 0 48 48" fill="none">
        {value === 'X' ? (
          <Path d="M12 12L36 36M36 12L12 36" stroke={color} strokeWidth={5.5} strokeLinecap="round" />
        ) : (
          <Circle cx={24} cy={24} r={13.5} stroke={color} strokeWidth={5.5} />
        )}
      </Svg>
    </Animated.View>
  );
};
