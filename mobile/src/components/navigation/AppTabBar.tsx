import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gamepad2, Home, Trophy, User, Users } from 'lucide-react-native';
import { iconSize } from '../../design-system/icons';
import { radius } from '../../design-system/radius';
import { lift } from '../../design-system/shadows';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from '../common/Pressy';

const ICONS: Record<string, { label: string; Icon: React.ComponentType<{ size: number; color: string }> }> = {
  HomeTab: { label: 'Home', Icon: Home },
  FriendsTab: { label: 'Friends', Icon: Users },
  PlayTab: { label: 'Play', Icon: Gamepad2 },
  RankingTab: { label: 'Ranking', Icon: Trophy },
  ProfileTab: { label: 'Profile', Icon: User },
};

/** Five-slot bar with the raised centre "Play" button (solid accent, no gradient or glow). */
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
              <View style={[styles.play, lift, { backgroundColor: c.accentFill, borderColor: focused ? c.onAccent : c.accentFill }]}>
                <meta.Icon size={iconSize.lg} color={c.onAccent} />
              </View>
            ) : (
              <meta.Icon size={iconSize.md} color={color} />
            )}
            <Text style={[type.caption, { color, fontFamily: focused ? fonts.body.semibold : fonts.body.medium, marginTop: isPlay ? 4 : 0 }]}>{meta.label}</Text>
          </Pressy>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', minHeight: 68, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 48 },
  play: { width: 48, height: 48, borderRadius: radius.lg, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
