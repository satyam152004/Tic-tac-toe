import React, { useState } from 'react';
import { Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste, KeyRound } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { Screen } from '../../components/common/Screen';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { joinRoomByCode } from '../../services/onlineActions';
import { toast } from '../../store/toastStore';

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

  return (
    <Screen title="Join Room" onBack={back} footer={<AppButton testID="join-room-submit" title="Join Room" fullWidth loading={busy} disabled={code.length === 0} onPress={join} />}>
      <AppCard>
        <View style={{ gap: 10 }}>
          <Text style={[type.smallStrong, { color: c.textSecondary }]}>Enter 6-Character Room Code</Text>
          <AppInput
            testID="room-code-input"
            value={code}
            onChangeText={(v) => {
              setCode(clean(v));
              setError(null);
            }}
            placeholder="e.g. VTX409"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CODE_LENGTH}
            leftIcon={<KeyRound size={18} color={c.textSecondary} />}
            error={error}
            returnKeyType="go"
            onSubmitEditing={join}
            style={{ fontFamily: 'JetBrainsMono_700Bold', fontSize: 18, letterSpacing: 4 }}
          />
          <AppButton testID="paste-code" title="Paste from clipboard" variant="secondary" size="md" icon={<ClipboardPaste size={16} color={c.accent} />} onPress={paste} />
        </View>
      </AppCard>
    </Screen>
  );
};
