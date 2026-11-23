import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { fonts } from '../../design-system/typography';
import { useNetworkStore } from '../../store/networkStore';

import { fs, ms } from '../../design-system/responsive';
const AMBER = '#B45309';

/** Compact amber banner docked below the status bar while the device is offline. Local games keep working. */
export const NetworkStatus: React.FC = () => {
  const insets = useSafeAreaInsets();
  const online = useNetworkStore((s) => s.online);
  if (online !== false) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(160)}
      exiting={FadeOutUp.duration(160)}
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + 4 }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel="Offline. Reconnecting. Local games still work."
    >
      <View style={styles.banner}>
        <View style={styles.left}>
          <WifiOff size={ms(18)} color={AMBER} />
          <Text numberOfLines={1} style={styles.text}>Offline · Reconnecting...</Text>
        </View>
        <ActivityIndicator size="small" color={AMBER} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 200 },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', paddingHorizontal: 12, paddingVertical: ms(10) },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  text: { fontSize: fs(11), fontFamily: fonts.body.semibold, color: AMBER },
});
