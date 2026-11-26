import React from 'react';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { AchievementsScreen } from '../screens/progression/AchievementsScreen';
import { DailyRewardsScreen } from '../screens/progression/DailyRewardsScreen';
import { GameStatisticsScreen } from '../screens/progression/GameStatisticsScreen';
import { FriendProfileScreen } from '../screens/social/FriendProfileScreen';
import { Stack } from './stack';

/** Profile, social detail and progression screens. */
export const profileScreens = () => (
  <Stack.Group key="profile">
    <Stack.Screen name="edit_profile" component={EditProfileScreen} />
    <Stack.Screen name="friend_profile" component={FriendProfileScreen} />
    <Stack.Screen name="game_statistics" component={GameStatisticsScreen} />
    <Stack.Screen name="achievements" component={AchievementsScreen} />
    <Stack.Screen name="daily_rewards" component={DailyRewardsScreen} />
  </Stack.Group>
);
