import React from 'react';
import { GameRulesScreen } from '../screens/home/GameRulesScreen';
import { PlayerSetupScreen } from '../screens/home/PlayerSetupScreen';
import { AiDifficultyScreen } from '../screens/offline/AiDifficultyScreen';
import { BoardSelectionScreen } from '../screens/offline/BoardSelectionScreen';
import { GamePauseScreen } from '../screens/offline/GamePauseScreen';
import { GameResultScreen } from '../screens/offline/GameResultScreen';
import { OfflineBoardScreen } from '../screens/offline/OfflineBoardScreen';
import { OfflineHistoryScreen } from '../screens/offline/OfflineHistoryScreen';
import { RematchScreen } from '../screens/offline/RematchScreen';
import { Stack } from './stack';

/** Offline game flow. Swipe-back is disabled on the live board (a back guard asks before abandoning a match). */
export const gameScreens = () => (
  <Stack.Group key="game">
    <Stack.Screen name="player_setup" component={PlayerSetupScreen} />
    <Stack.Screen name="game_rules" component={GameRulesScreen} />
    <Stack.Screen name="board_selection" component={BoardSelectionScreen} />
    <Stack.Screen name="ai_difficulty" component={AiDifficultyScreen} />
    <Stack.Screen name="offline_board" component={OfflineBoardScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="game_pause" component={GamePauseScreen} options={{ presentation: 'transparentModal', animation: 'fade' }} />
    <Stack.Screen name="game_result" component={GameResultScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
    <Stack.Screen name="rematch" component={RematchScreen} />
    <Stack.Screen name="offline_history" component={OfflineHistoryScreen} />
  </Stack.Group>
);
