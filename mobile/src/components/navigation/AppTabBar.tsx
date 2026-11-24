import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Trophy, User, Users } from 'lucide-react-native';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { CHROME_FONT_MAX, ms } from '../../design-system/responsive';
import { Pressy } from '../common/Pressy';

const ICONS: Record<string, { label: string; Icon: React.ComponentType<{ size: number; color: string }> }> = {
  HomeTab: { label: 'Home', Icon: Home },
  FriendsTab: { label: 'Friends', Icon: Users },
  RankingTab: { label: 'Ranking', Icon: Trophy },
  ProfileTab: { label: 'Profile', Icon: User },
};

/** Four-slot bar: Home, Friends, Ranking, Profile. Game modes are picked on Home. */
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
        return (
          <Pressy
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityLabel={meta.label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            scaleTo={0.94}
            style={styles.item}
          >
            <meta.Icon size={ms(24)} color={color} />
            <Text maxFontSizeMultiplier={CHROME_FONT_MAX} style={[type.caption, { color, fontFamily: focused ? fonts.body.semibold : fonts.body.medium }]}>{meta.label}</Text>
          </Pressy>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', minHeight: ms(68), borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: ms(50) },
});
