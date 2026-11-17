import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useNetworkStore } from '../../store/networkStore';

/** Slim banner shown while the device is offline. Local games keep working, online features pause. */
export const NetworkStatus: React.FC = () => {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const online = useNetworkStore((s) => s.online);
  if (online !== false) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(160)}
      exiting={FadeOutUp.duration(160)}
      pointerEvents="none"
      style={[styles.wrap, { top: 0, paddingTop: insets.top + 4, backgroundColor: c.warning }]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        <WifiOff size={14} color="#1a1200" />
        <Text style={[type.smallStrong, { color: '#1a1200' }]}>You are offline. Local games still work.</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, zIndex: 200, paddingBottom: 6, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
