import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';

export const AppLoader: React.FC<{ label?: string; sublabel?: string }> = ({ label = 'Loading...', sublabel }) => {
  const c = useTheme();
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1, false);
  }, [rot]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={styles.badge}>
        <View style={[StyleSheet.absoluteFill, styles.ring, { borderColor: c.accent + '40' }]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.ring, { borderColor: 'transparent', borderTopColor: c.accent, borderRightColor: c.x }, spin]} />
        <Text style={[type.subheading, { color: c.text }]}>XO</Text>
      </View>
      <Text style={[type.subheading, { color: c.text, marginTop: 16 }]}>{label}</Text>
      {sublabel ? <Text style={[type.small, { color: c.textSecondary, marginTop: 4, textAlign: 'center' }]}>{sublabel}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  badge: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  ring: { borderRadius: 16, borderWidth: 2 },
});
