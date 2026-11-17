import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { ErrorState } from '../../components/feedback/StateViews';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { gameApi } from '../../services/api/gameApi';
import type { BoardSize } from '../../services/api/types';
import { createRoom } from '../../services/onlineActions';
import { BoardSizePicker, isOfflineError } from './shared';

export const CreateRoomScreen: React.FC<RootScreenProps<'create_room'>> = () => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const [size, setSize] = useState<BoardSize>(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom(size);
      nav.replace('room_details', { roomId: room.id });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  const returnToGame = async () => {
    try {
      const g = (await gameApi.active()).find((x) => x.status === 'IN_PROGRESS' || x.status === 'READY' || x.status === 'WAITING');
      if (g) nav.replace('online_board', { gameId: g.id });
      else setError(null);
    } catch (e) {
      setError(e);
    }
  };

  const code = error ? toApiError(error).code : null;

  return (
    <Screen
      title="Create Private Room"
      onBack={back}
      footer={<AppButton testID="create-room-submit" title="Create Room" fullWidth loading={busy} onPress={submit} />}
    >
      <Text style={[type.smallStrong, { color: c.textSecondary }]}>Select Board Size</Text>
      <BoardSizePicker value={size} onChange={setSize} />

      <AppCard>
        <Text style={[type.subheading, { color: c.text }]}>Private room</Text>
        <Text style={[type.small, { color: c.textSecondary, marginTop: 2 }]}>
          A 6-character code is generated when you create the room. Share it with a friend; the room expires automatically if nobody joins.
        </Text>
      </AppCard>

      {error ? (
        <View style={styles.err} testID="create-room-error">
          {code === 'ALREADY_IN_GAME' ? (
            <ErrorState title="You are already in a game" message={friendlyMessage(error)} retryLabel="Return to game" onRetry={returnToGame} />
          ) : code === 'ALREADY_IN_ROOM' ? (
            <ErrorState title="You already have a room" message="Leave your current room before creating a new one." retryLabel="Back to lobby" onRetry={back} />
          ) : (
            <ErrorState offline={isOfflineError(error)} message={friendlyMessage(error)} onRetry={submit} />
          )}
        </View>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({ err: { marginTop: 4 } });
