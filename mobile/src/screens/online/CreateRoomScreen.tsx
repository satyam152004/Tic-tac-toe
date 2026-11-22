import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { ErrorState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { gameApi } from '../../services/api/gameApi';
import type { BoardSize } from '../../services/api/types';
import { createRoom } from '../../services/onlineActions';
import { isOfflineError } from './shared';

const GRID_OPTIONS: { label: string; size: BoardSize }[] = [
  { label: '3×3', size: 3 },
  { label: '4×4', size: 4 },
  { label: '5×5', size: 5 },
];

const TIMER_OPTIONS = ['15s', '30s', 'Off'];

export const CreateRoomScreen: React.FC<RootScreenProps<'create_room'>> = () => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const [size, setSize] = useState<BoardSize>(3);
  const [timer, setTimer] = useState('30s');
  const [isPrivate, setIsPrivate] = useState(true);
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
      title="Create Room"
      onBack={back}
      footer={
        <AppButton
          testID="create-room-submit"
          title="Generate Room Code"
          fullWidth
          loading={busy}
          onPress={submit}
        />
      }
    >
      <View style={{ gap: 16 }}>
        {/* Grid Size Selector */}
        <View style={{ gap: 6 }}>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>GRID SIZE</Text>
          <View style={[styles.segment, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
            {GRID_OPTIONS.map((g) => {
              const active = size === g.size;
              return (
                <Pressy
                  key={g.label}
                  onPress={() => setSize(g.size)}
                  style={[
                    styles.segmentBtn,
                    active && [styles.segmentBtnActive, { backgroundColor: c.bgCard }],
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: active ? c.accent : c.textSecondary,
                        fontFamily: active ? fonts.body.semibold : fonts.body.medium,
                      },
                    ]}
                  >
                    {g.label}
                  </Text>
                </Pressy>
              );
            })}
          </View>
        </View>

        {/* Turn Timer Selector */}
        <View style={{ gap: 6 }}>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>TURN TIMER</Text>
          <View style={[styles.segment, { backgroundColor: c.bgSecondary, borderColor: c.border }]}>
            {TIMER_OPTIONS.map((tm) => {
              const active = timer === tm;
              return (
                <Pressy
                  key={tm}
                  onPress={() => setTimer(tm)}
                  style={[
                    styles.segmentBtn,
                    active && [styles.segmentBtnActive, { backgroundColor: c.bgCard }],
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color: active ? c.accent : c.textSecondary,
                        fontFamily: active ? fonts.body.semibold : fonts.body.medium,
                      },
                    ]}
                  >
                    {tm}
                  </Text>
                </Pressy>
              );
            })}
          </View>
        </View>

        {/* Private Room Toggle Card */}
        <View style={[styles.toggleCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.toggleTitle, { color: c.text }]}>Private Room</Text>
            <Text style={[styles.toggleSub, { color: c.textSecondary }]}>
              {isPrivate ? 'Invite-only via 6-character code' : 'Listed in public Open Rooms'}
            </Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: '#E4E4DF', true: '#BFDBFE' }}
            thumbColor={isPrivate ? c.accent : '#F1F1EE'}
          />
        </View>

        {error ? (
          <View style={{ marginTop: 4 }} testID="create-room-error">
            {code === 'ALREADY_IN_GAME' ? (
              <ErrorState title="You are already in a game" message={friendlyMessage(error)} retryLabel="Return to game" onRetry={returnToGame} />
            ) : code === 'ALREADY_IN_ROOM' ? (
              <ErrorState title="You already have a room" message="Leave your current room before creating a new one." retryLabel="Back to lobby" onRetry={back} />
            ) : (
              <ErrorState offline={isOfflineError(error)} message={friendlyMessage(error)} onRetry={submit} />
            )}
          </View>
        ) : null}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 10.5,
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 12,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  toggleTitle: {
    fontSize: 13,
    fontFamily: fonts.body.semibold,
  },
  toggleSub: {
    fontSize: 11,
  },
});
