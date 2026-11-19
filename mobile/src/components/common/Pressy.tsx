import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Opacity while pressed. Together with the small scale this is the app-wide pressed state. */
const PRESSED_OPACITY = 0.86;

/** Pressable with a pressed state: a subtle scale and dim while the finger is down. */
export const Pressy: React.FC<PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number }> = ({
  style,
  scaleTo = 0.98,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const s = useSharedValue(1);
  const o = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: o.value }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(e) => {
        s.value = withTiming(scaleTo, { duration: 90 });
        o.value = withTiming(PRESSED_OPACITY, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withTiming(1, { duration: 120 });
        o.value = withTiming(1, { duration: 120 });
        onPressOut?.(e);
      }}
      style={[style, anim]}
    />
  );
};
