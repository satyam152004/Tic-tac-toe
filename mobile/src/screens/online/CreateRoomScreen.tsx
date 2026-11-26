import { type } from '../../design-system/typography';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { ErrorState } from '../../components/feedback/StateViews';
import { ActionButton } from '../../components/game/ActionButton';
import { SegmentedControl } from '../../components/game/SegmentedControl';
import { ToggleSwitch } from '../../components/game/ToggleSwitch';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { gameApi } from '../../services/api/gameApi';
import type { BoardSize, EntryAmount, FirstMovePref } from '../../services/api/types';
import { isPreStart, matchFoundSource } from '../../services/gameRoute';
import { createRoomWithOptions, isOfflineError, type TurnTimer } from './shared';

import { ch, fs, ms } from '../../design-system/responsive';
const GRID_OPTIONS = ([3, 4, 5] as BoardSize[]).map((n) => ({ value: n, label: `${n}×${n}`, testID: `create-grid-${n}` }));
const ENTRY_OPTIONS: { value: EntryAmount; label: string; testID: string }[] = [
  { value: 0, label: 'Free', testID: 'create-entry-0' },
  { value: 10, label: '10', testID: 'create-entry-10' },
  { value: 25, label: '25', testID: 'create-entry-25' },
  { value: 50, label: '50', testID: 'create-entry-50' },
];
const FIRST_OPTIONS: { value: FirstMovePref; label: string; testID: string }[] = [
  { value: 'ME', label: 'Me', testID: 'create-first-me' },
  { value: 'OPPONENT', label: 'Opponent', testID: 'create-first-opponent' },
  { value: 'RANDOM', label: 'Random', testID: 'create-first-random' },
];
const TIMER_OPTIONS: { value: TurnTimer; label: string; testID: string }[] = [
  { value: 15, label: '15s', testID: 'create-timer-15' },
  { value: 30, label: '30s', testID: 'create-timer-30' },
  { value: 0, label: 'Off', testID: 'create-timer-0' },
];

export const CreateRoomScreen: React.FC<RootScreenProps<'create_room'>> = () => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const [size, setSize] = useState<BoardSize>(3);
  const [timer, setTimer] = useState<TurnTimer>(30);
  const [firstMove, setFirstMove] = useState<FirstMovePref>('RANDOM');
  const [entryAmount, setEntryAmount] = useState<EntryAmount>(0);
  const [isPrivate, setIsPrivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const room = await createRoomWithOptions(size, { isPublic: !isPrivate, turnTimeoutSec: timer, firstMove, entryAmount });
      nav.replace('waiting_room', { roomId: room.id });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  const returnToGame = async () => {
    try {
      const g = (await gameApi.active()).find((x) => x.status === 'IN_PROGRESS' || x.status === 'READY' || x.status === 'WAITING');
      if (g && isPreStart(g)) nav.replace('match_found', { gameId: g.id, source: matchFoundSource(g.type) });
      else if (g) nav.replace('online_board', { gameId: g.id });
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
      footer={<ActionButton testID="create-room-submit" title="Create room code" fullWidth loading={busy} onPress={submit} />}
    >
      <View style={{ gap: ms(14) }}>
        <View>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>BOARD SIZE</Text>
          <SegmentedControl label="Board size" options={GRID_OPTIONS} value={size} onChange={setSize} />
        </View>

        <View>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>ENTRY (COINS)</Text>
          <SegmentedControl label="Entry price" options={ENTRY_OPTIONS} value={entryAmount} onChange={setEntryAmount} />
          <Text style={[styles.rowSub, { color: c.textSecondary, marginTop: ms(4) }]}>Each player pays the entry when the match starts. The winner takes both entries.</Text>
        </View>

        <View>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>WHO GOES FIRST</Text>
          <SegmentedControl label="Who goes first" options={FIRST_OPTIONS} value={firstMove} onChange={setFirstMove} />
        </View>

        <View>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>TURN TIMER</Text>
          <SegmentedControl label="Turn timer" options={TIMER_OPTIONS} value={timer} onChange={setTimer} />
        </View>

        <View style={[styles.group, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Pressy
            testID="create-private"
            accessibilityRole="switch"
            accessibilityLabel="Private Room"
            accessibilityState={{ checked: isPrivate }}
            onPress={() => setIsPrivate((v) => !v)}
            style={styles.row}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: c.text }]}>Private Room</Text>
              <Text style={[styles.rowSub, { color: c.textSecondary }]}>
                {isPrivate ? 'Only people with the code can join' : 'Shows up in Open Rooms'}
              </Text>
            </View>
            <ToggleSwitch value={isPrivate} />
          </Pressy>
        </View>

        {error ? (
          <View style={{ marginTop: ms(4) }} testID="create-room-error">
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
  sectionLabel: { ...type.overline, letterSpacing: 0.5, marginBottom: ms(5) },
  group: { borderRadius: ms(14), borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: ch(38), paddingVertical: ms(8), paddingHorizontal: ms(13), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: ms(8) },
  rowTitle: { ...type.labelStrong, },
  rowSub: { ...type.overline, },
});
