import React from 'react';
import { CreateRoomScreen } from '../screens/online/CreateRoomScreen';
import { JoinRoomScreen } from '../screens/online/JoinRoomScreen';
import { MatchInvitationScreen } from '../screens/online/MatchInvitationScreen';
import { MatchmakingScreen } from '../screens/online/MatchmakingScreen';
import { MatchFoundScreen } from '../screens/online/MatchFoundScreen';
import { GameBoardScreen } from '../screens/game/GameBoardScreen';
import { OnlineLobbyScreen } from '../screens/online/OnlineLobbyScreen';
import { GameResultScreen } from '../screens/game/GameResultScreen';
import { ReconnectionScreen } from '../screens/online/ReconnectionScreen';
import { SpectateMatchScreen } from '../screens/online/SpectateMatchScreen';
import { RoomDetailsScreen } from '../screens/online/RoomDetailsScreen';
import { WaitingRoomScreen } from '../screens/online/WaitingRoomScreen';
import { withOverlayToast } from '../components/feedback/AppToast';
import { Stack } from './stack';

/** Presented as a native modal, which draws above the root toast host, so it hosts its own toast layer. */
const MatchInvitationModal = withOverlayToast(MatchInvitationScreen);

export const onlineScreens = () => (
  <Stack.Group key="online">
    <Stack.Screen name="online_lobby" component={OnlineLobbyScreen} />
    <Stack.Screen name="matchmaking" component={MatchmakingScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="match_found" component={MatchFoundScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="waiting_room" component={WaitingRoomScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="online_board" component={GameBoardScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="create_room" component={CreateRoomScreen} />
    <Stack.Screen name="join_room" component={JoinRoomScreen} />
    <Stack.Screen name="room_details" component={RoomDetailsScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="online_result" component={GameResultScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
    <Stack.Screen name="reconnection" component={ReconnectionScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
    <Stack.Screen name="spectate_match" component={SpectateMatchScreen} />
    <Stack.Screen name="match_invitation" component={MatchInvitationModal} options={{ presentation: 'modal' }} />
  </Stack.Group>
);
