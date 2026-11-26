import React from 'react';
import { GameRulesScreen } from '../screens/home/GameRulesScreen';
import { MatchSetupScreen } from '../screens/offline/MatchSetupScreen';
import { GameResultScreen } from '../screens/game/GameResultScreen';
import { GameBoardScreen } from '../screens/game/GameBoardScreen';
import { OfflineHistoryScreen } from '../screens/offline/OfflineHistoryScreen';
import { RematchScreen } from '../screens/offline/RematchScreen';
import { Stack } from './stack';

/** Offline game flow. Swipe-back is disabled on the live board (a back guard asks before abandoning a match). */
export const gameScreens = () => (
  <Stack.Group key="game">
    <Stack.Screen name="match_setup" component={MatchSetupScreen} />
    <Stack.Screen name="game_rules" component={GameRulesScreen} />
    <Stack.Screen name="offline_board" component={GameBoardScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="game_result" component={GameResultScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
    <Stack.Screen name="rematch" component={RematchScreen} />
    <Stack.Screen name="offline_history" component={OfflineHistoryScreen} />
  </Stack.Group>
);
