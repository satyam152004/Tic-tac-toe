import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with subtle scale feedback (prototype: active:scale-[0.98]). */
export const Pressy: React.FC<PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number }> = ({
  style,
  scaleTo = 0.98,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(e) => {
        s.value = withTiming(scaleTo, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withTiming(1, { duration: 120 });
        onPressOut?.(e);
      }}
      style={[style, anim]}
    />
  );
};
