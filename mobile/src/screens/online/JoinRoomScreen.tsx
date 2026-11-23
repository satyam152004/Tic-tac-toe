import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator } from 'react-native';
import { ActionButton } from '../../components/game/ActionButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { joinRoomByCode } from '../../services/onlineActions';
import { toast } from '../../store/toastStore';
import { OPEN_ROOMS_KEY, fetchOpenRooms, timerLabel } from './shared';

const CODE_LENGTH = 6;
const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

const JOIN_ERRORS: Record<string, string> = {
  ROOM_NOT_FOUND: 'Room code not found. Check the code and try again.',
  ROOM_EXPIRED: 'That room has expired. Ask your friend to create a new one.',
  ROOM_FULL: 'That room is already full.',
  BLOCKED: 'You cannot join this room.',
  ALREADY_IN_GAME: 'You are already in a game.',
  ALREADY_IN_ROOM: 'Leave your current room before joining another.',
};

export const joinErrorMessage = (e: unknown): string => JOIN_ERRORS[toApiError(e).code] ?? friendlyMessage(e);

export const JoinRoomScreen: React.FC<RootScreenProps<'join_room'>> = ({ route }) => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const [code, setCode] = useState(() => clean(route.params?.code ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = useQuery({ queryKey: OPEN_ROOMS_KEY, queryFn: () => fetchOpenRooms(10), staleTime: 5000 });

  const paste = async () => {
    try {
      const text = clean(await Clipboard.getStringAsync());
      if (!text) return toast.info('Clipboard is empty');
      setCode(text);
      setError(null);
    } catch {
      toast.error('Could not read the clipboard');
    }
  };

  const join = async () => {
    if (busy) return;
    if (code.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-character room code.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await joinRoomByCode(code);
      nav.replace('waiting_room', { roomId: room.id });
    } catch (e) {
      setError(joinErrorMessage(e));
      setBusy(false);
    }
  };

  const formattedCode = code.length >= 3 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;

  return (
    <Screen
      title="Join Room"
      onBack={back}
      footer={
        <ActionButton
          testID="join-room-submit"
          title="Join Match"
          fullWidth
          loading={busy}
          disabled={code.length === 0}
          onPress={join}
        />
      }
    >
      <View style={{ gap: 16 }}>
        {/* Code Input Header & Boxes */}
        <View style={{ gap: 8 }}>
          <View style={styles.headerRow}>
            <Text style={[styles.codeLabel, { color: c.textSecondary }]}>
              Room Code{code ? ` (${formattedCode})` : ''}
            </Text>
            <Pressy testID="paste-code" onPress={paste}>
              <Text style={[styles.pasteText, { color: c.accent }]}>Paste Code</Text>
            </Pressy>
          </View>

          {/* 6 character boxes */}
          <View style={styles.codeBoxes}>
            {Array.from({ length: CODE_LENGTH }).map((_, idx) => {
              const char = code[idx] ?? '';
              const isFocused = idx === Math.min(code.length, CODE_LENGTH - 1);
              return (
                <View
                  key={idx}
                  style={[
                    styles.box,
                    {
                      backgroundColor: c.bgCard,
                      borderColor: char ? c.accent : isFocused ? c.accent : c.border,
                      borderWidth: isFocused || char ? 1.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.boxChar, { color: c.text }]}>{char}</Text>
                </View>
              );
            })}
          </View>

          {/* Hidden full-width input so typing taps naturally */}
          <TextInput
            testID="room-code-input"
            value={code}
            onChangeText={(v) => {
              setCode(clean(v));
              setError(null);
            }}
            placeholder=""
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CODE_LENGTH}
            style={styles.hiddenInput}
            returnKeyType="go"
            onSubmitEditing={join}
          />
        </View>

        {error ? (
          <Text style={[type.small, { color: c.danger }]}>{error}</Text>
        ) : null}

        {/* Recent public rooms: real open rooms from GET /rooms/open; tapping one fills the code boxes */}
        <View>
          <Text style={[styles.sectionLabel, { color: '#8E939E' }]}>RECENT PUBLIC ROOMS</Text>
          <View testID="public-rooms" style={[styles.group, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            {open.isLoading ? (
              <View style={styles.pubRow}>
                <ActivityIndicator color={c.accent} />
              </View>
            ) : open.isError ? (
              <Pressy testID="public-rooms-retry" accessibilityLabel="Retry loading public rooms" onPress={() => void open.refetch()} style={styles.pubRow}>
                <Text style={[styles.pubSub, { color: c.textSecondary, flex: 1 }]}>{friendlyMessage(open.error)}</Text>
                <Text style={[styles.pubAction, { color: c.accent }]}>Retry</Text>
              </Pressy>
            ) : (open.data ?? []).length === 0 ? (
              <View style={styles.pubRow}>
                <Text testID="public-rooms-empty" style={[styles.pubSub, { color: c.textSecondary }]}>No public rooms right now.</Text>
              </View>
            ) : (
              (open.data ?? []).map((r, i) => (
                <Pressy
                  key={r.id}
                  testID={`public-room-${r.id}`}
                  accessibilityLabel={`Select room ${r.code} hosted by ${r.host.displayName}`}
                  onPress={() => {
                    setCode(clean(r.code));
                    setError(null);
                  }}
                  scaleTo={0.995}
                  style={[styles.pubRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
                >
                  <View>
                    <Text style={[styles.pubCode, { color: c.text }]}>{r.code}</Text>
                    <Text style={[styles.pubSub, { color: c.textSecondary }]}>
                      {r.host.displayName} • {r.boardSize}×{r.boardSize} • {timerLabel(r.turnTimeoutSec)}
                    </Text>
                  </View>
                  <Text style={[styles.pubAction, { color: c.accent }]}>Select →</Text>
                </Pressy>
              ))
            )}
          </View>
        </View>

      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeLabel: { fontSize: 11.5, fontFamily: fonts.body.semibold },
  pasteText: { fontSize: 11.5, fontFamily: fonts.body.semibold },
  codeBoxes: { flexDirection: 'row', gap: 6 },
  box: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  boxChar: { fontSize: 16, fontFamily: fonts.mono.semibold },
  hiddenInput: { position: 'absolute', top: 24, left: 0, right: 0, bottom: 0, opacity: 0.01 },
  sectionLabel: { fontSize: 10, fontFamily: fonts.body.semibold, letterSpacing: 0.5, marginBottom: 5 },
  group: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  pubRow: { minHeight: 38, paddingVertical: 10, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pubCode: { fontSize: 12, fontFamily: fonts.mono.semibold },
  pubSub: { fontSize: 10.5, fontFamily: fonts.body.regular },
  pubAction: { fontSize: 11.5, fontFamily: fonts.body.semibold },
});
