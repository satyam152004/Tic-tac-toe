import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2, Home, Trophy, User, Users } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from '../common/Pressy';

const ICONS: Record<string, { label: string; Icon: React.ComponentType<{ size: number; color: string }> }> = {
  HomeTab: { label: 'Home', Icon: Home },
  FriendsTab: { label: 'Friends', Icon: Users },
  PlayTab: { label: 'Play', Icon: Gamepad2 },
  RankingTab: { label: 'Ranking', Icon: Trophy },
  ProfileTab: { label: 'Profile', Icon: User },
};

/** Five-slot bar from the prototype with the raised centre "Play" button. */
export const AppTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { backgroundColor: c.bgSecondary, borderTopColor: c.border, paddingBottom: insets.bottom }]}>
      {state.routes.map((route, i) => {
        const meta = ICONS[route.name];
        if (!meta) return null;
        const focused = state.index === i;
        const color = focused ? c.accent : c.textSecondary;
        const onPress = () => {
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name as never);
        };
        const isPlay = route.name === 'PlayTab';
        return (
          <Pressy
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityLabel={meta.label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            scaleTo={0.94}
            style={[styles.item, isPlay && { marginTop: -16 }]}
          >
            {isPlay ? (
              <LinearGradient colors={[c.accent, c.accentSecondary]} style={[styles.play, { shadowColor: c.accent }, focused && { borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' }]}>
                <meta.Icon size={24} color="#fff" />
              </LinearGradient>
            ) : (
              <meta.Icon size={20} color={color} />
            )}
            <Text style={[styles.label, { color, fontWeight: focused ? '700' : '500', marginTop: isPlay ? 4 : 0 }]}>{meta.label}</Text>
          </Pressy>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', minHeight: 68, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 48 },
  play: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  label: { fontSize: 11 },
});
