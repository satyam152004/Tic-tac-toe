import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { joinRoomByCode } from '../../services/onlineActions';
import { toast } from '../../store/toastStore';

const CODE_LENGTH = 6;
const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

const RECENT_ROOMS = [
  { code: 'TTT842', display: 'TTT-842', desc: 'Rohan • 3×3 • 30s' },
  { code: 'TTT419', display: 'TTT-419', desc: 'Meera • 4×4 • 15s' },
];

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
        <AppButton
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
              Room Code {code ? `(${formattedCode})` : ''}
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

        {/* Recent Public Rooms */}
        <View style={{ gap: 8 }}>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>RECENT PUBLIC ROOMS</Text>
          <View style={[styles.roomsGroup, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            {RECENT_ROOMS.map((r, i) => (
              <Pressy
                key={r.code}
                onPress={() => {
                  setCode(r.code);
                  setError(null);
                }}
                style={[
                  styles.roomRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                ]}
              >
                <View>
                  <Text style={[styles.roomCode, { color: c.text }]}>{r.display}</Text>
                  <Text style={[styles.roomDesc, { color: c.textSecondary }]}>{r.desc}</Text>
                </View>
                <Text style={[styles.selectArrow, { color: c.accent }]}>Select →</Text>
              </Pressy>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: fonts.body.semibold,
  },
  pasteText: {
    fontSize: 12,
    fontFamily: fonts.body.semibold,
  },
  codeBoxes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  box: {
    flex: 1,
    height: 48,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChar: {
    fontSize: 18,
    fontFamily: fonts.mono.semibold,
  },
  hiddenInput: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  roomsGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  roomCode: {
    fontSize: 13,
    fontFamily: fonts.mono.semibold,
  },
  roomDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  selectArrow: {
    fontSize: 12,
    fontFamily: fonts.body.semibold,
  },
});
