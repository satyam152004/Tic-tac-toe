import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { AppTabBar } from '../components/navigation/AppTabBar';
import { HomeScreen } from '../screens/home/HomeScreen';
import { UserProfileScreen } from '../screens/profile/UserProfileScreen';
import { FriendsScreen } from '../screens/social/FriendsScreen';
import { LeaderboardScreen } from '../screens/social/LeaderboardScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** The four bottom tabs (Home, Friends, Ranking, Profile); game modes are chosen on Home. */
export function MainTabNavigator() {
  return (
    <Tab.Navigator tabBar={(p) => <AppTabBar {...p} />} screenOptions={{ headerShown: false, lazy: true }} initialRouteName="HomeTab">
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="FriendsTab" component={FriendsScreen} />
      <Tab.Screen name="RankingTab" component={LeaderboardScreen} />
      <Tab.Screen name="ProfileTab" component={UserProfileScreen} />
    </Tab.Navigator>
  );
}
