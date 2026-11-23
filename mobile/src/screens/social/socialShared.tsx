import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Swords } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppModal } from '../../components/common/AppModal';
import { Pressy } from '../../components/common/Pressy';
import { ms } from '../../design-system/responsive';
import { type } from '../../design-system/typography';
import type { BoardSize } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import { gameApi } from '../../services/api/gameApi';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';

const SOCIAL_ERRORS: Record<string, string> = {
  USER_NOT_FOUND: "We can't find a player with that username.",
  SELF_REQUEST: "You can't add yourself.",
  ALREADY_FRIENDS: "You're already friends.",
  REQUEST_ALREADY_SENT: 'You already sent a friend request.',
  BLOCKED: "You can't do that with this player.",
  NOT_FRIENDS: 'You can only challenge friends.',
  ALREADY_IN_GAME: "You're already in a game.",
  SELF_REPORT: "You can't report yourself.",
  REPORT_LIMIT: "You've already reported this player too many times.",
};

export const socialError = (e: unknown): string => SOCIAL_ERRORS[toApiError(e).code] ?? friendlyMessage(e);
export const isOffline = (e: unknown): boolean => !!e && toApiError(e).code === 'NETWORK_ERROR';

const SIZES: BoardSize[] = [3, 4, 5];

/** Challenge flow shared by the friends list and the friend profile. */
export function useChallenge() {
  const { nav } = useAppNav();
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const send = useCallback(
    async (boardSize: BoardSize) => {
      if (!target || busy) return;
      setBusy(true);
      try {
        const game = await gameApi.inviteFriend({ opponentId: target.id, boardSize });
        useOnlineStore.getState().applyGame(game);
        setTarget(null);
        toast.success('Challenge sent', `Waiting for ${target.name} to join`);
        nav.navigate('online_board', { gameId: game.id });
      } catch (e) {
        toast.error("Couldn't send the challenge", socialError(e));
      } finally {
        setBusy(false);
      }
    },
    [target, busy, nav],
  );

  const sheet = <ChallengeSheet name={target?.name ?? null} busy={busy} onClose={() => setTarget(null)} onSend={send} />;
  return { challenge: (id: string, name: string) => setTarget({ id, name }), sheet };
}

const ChallengeSheet: React.FC<{ name: string | null; busy: boolean; onClose: () => void; onSend: (s: BoardSize) => void }> = ({ name, busy, onClose, onSend }) => {
  const c = useTheme();
  const [size, setSize] = useState<BoardSize>(3);
  return (
    <AppModal open={!!name} title={`Challenge ${name ?? ''}`} onClose={onClose}>
      <Text style={[type.body, { color: c.textSecondary }]}>Pick a board size. They'll get an invite, and the match starts when they join.</Text>
      <View style={styles.sizes}>
        {SIZES.map((s) => {
          const on = s === size;
          return (
            <Pressy
              key={s}
              testID={`challenge-size-${s}`}
              accessibilityLabel={`${s} by ${s} board`}
              accessibilityState={{ selected: on }}
              onPress={() => setSize(s)}
              style={[styles.size, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent + '26' : c.bgElevated }]}
            >
              <Text style={[type.num, { color: on ? c.accent : c.text }]}>{s}x{s}</Text>
            </Pressy>
          );
        })}
      </View>
      <AppButton testID="challenge-send" title="Send challenge" fullWidth loading={busy} icon={<Swords size={ms(18)} color="#fff" />} onPress={() => onSend(size)} />
    </AppModal>
  );
};

const styles = StyleSheet.create({
  sizes: { flexDirection: 'row', gap: 10 },
  size: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
