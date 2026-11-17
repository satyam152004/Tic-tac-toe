import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, View } from 'react-native';
import { Check, Send } from 'lucide-react-native';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppModal } from '../../components/common/AppModal';
import * as Clipboard from 'expo-clipboard';
import { EmptyState, ErrorState } from '../../components/feedback/StateViews';
import { useFriends } from '../../hooks/queries';
import { roomApi } from '../../services/api/roomApi';
import type { PlayerCard, Room } from '../../services/api/types';
import { friendlyMessage } from '../../services/api/errors';
import { useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';
import { defaultWinLength } from '../../game-engine';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import type { BoardSize } from '../../services/api/types';
import { toApiError } from '../../services/api/errors';
import { socketClient, type SocketStatus } from '../../services/socket/socketClient';

export const ONLINE_SIZES: BoardSize[] = [3, 4, 5];

export const isOfflineError = (e: unknown): boolean => toApiError(e).code === 'NETWORK_ERROR';

/** Live socket connection status. */
export function useSocketStatus(): SocketStatus {
  const [s, setS] = useState<SocketStatus>(socketClient.status);
  useEffect(() => {
    setS(socketClient.status);
    return socketClient.onStatus(setS);
  }, []);
  return s;
}

/** 3x3 / 4x4 / 5x5 selector used by quick match and room creation. */
export const BoardSizePicker: React.FC<{ value: BoardSize; onChange: (s: BoardSize) => void }> = ({ value, onChange }) => {
  const c = useTheme();
  return (
    <View style={styles.row}>
      {ONLINE_SIZES.map((sz) => (
        <View key={sz} style={{ flex: 1 }}>
          <AppCard selected={value === sz} onPress={() => onChange(sz)} padding="sm" testID={`size-${sz}`} accessibilityLabel={`${sz} by ${sz} board`}>
            <Text style={[type.heading, { color: c.text, textAlign: 'center', fontFamily: 'JetBrainsMono_700Bold' }]}>
              {sz}x{sz}
            </Text>
            <Text style={[type.caption, { color: c.textSecondary, textAlign: 'center' }]}>{defaultWinLength(sz)} to win</Text>
          </AppCard>
        </View>
      ))}
    </View>
  );
};

/** Big monospaced room code. */
export const CodeText: React.FC<{ code: string; color?: string }> = ({ code, color }) => {
  const c = useTheme();
  return (
    <Text
      accessibilityLabel={`Room code ${code.split('').join(' ')}`}
      testID="room-code"
      style={{ fontFamily: 'JetBrainsMono_700Bold', fontSize: 34, letterSpacing: 7, color: color ?? c.accent, textAlign: 'center' }}
    >
      {code}
    </Text>
  );
};


/** Share sheet for a room code (native share sheet, no custom link scheme invented). */
export async function shareRoomCode(room: Pick<Room, 'code' | 'boardSize' | 'winLength'>): Promise<void> {
  try {
    await Share.share({ message: `Join my ${room.boardSize}x${room.boardSize} Tic Tac Toe room! Room code: ${room.code}` });
  } catch {
    toast.error('Could not open the share sheet');
  }
}

/**
 * The room being viewed. The live copy is kept in `useOnlineStore` by `room:updated`; when the screen opens without it
 * (deep link, app restart) it is loaded once with GET /rooms/:id.
 */
export function useRoom(roomId: string) {
  const stored = useOnlineStore((s) => s.room);
  const ended = useOnlineStore((s) => s.roomEnded);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const fetchedFor = useRef<string | null>(null);
  const room = stored?.id === roomId ? stored : null;
  const seen = useRef(false); // once seen, a missing room means we left it: never re-fetch (it would resurrect it)
  if (room) seen.current = true;

  useEffect(() => {
    if (room || ended || seen.current) return;
    const key = `${roomId}:${attempt}`;
    if (fetchedFor.current === key) return;
    fetchedFor.current = key;
    let cancelled = false;
    roomApi
      .get(roomId)
      .then((r) => {
        if (!cancelled) useOnlineStore.getState().setRoom(r);
      })
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
      fetchedFor.current = null;
    };
  }, [roomId, room, ended, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((a) => a + 1);
  }, []);
  return { room, ended, loading: !room && !ended && !error, error, retry };
}

/** One seat in a room (host or guest) with readiness. */
export const PlayerSlot: React.FC<{ card: PlayerCard | null; role: string; mark: 'X' | 'O'; status?: string; ready?: boolean; highlight?: boolean }> = ({ card, role, mark, status, ready, highlight }) => {
  const c = useTheme();
  return (
    <AppCard selected={highlight} testID={`slot-${role.toLowerCase()}`}>
      <View style={styles.slot}>
        {card ? (
          <AppAvatar avatarId={card.avatar} name={card.displayName} size="md" />
        ) : (
          <View style={[styles.empty, { borderColor: c.border }]}>
            <Text style={[type.bodyStrong, { color: c.textSecondary }]}>?</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[type.subheading, { color: c.text }]}>{card?.displayName ?? 'Waiting for Opponent'}</Text>
          <Text style={[type.small, { color: c.textSecondary }]}>
            {role} · Plays {mark}
            {card ? ` · Level ${card.level}` : ''}
          </Text>
        </View>
        {card ? (
          <View style={styles.status}>
            {ready ? <Check size={16} color={c.success} /> : null}
            <Text style={[type.caption, { color: ready ? c.success : c.warning }]}>{status ?? (ready ? 'Ready' : 'Not ready')}</Text>
          </View>
        ) : null}
      </View>
    </AppCard>
  );
};

/** Bottom sheet listing friends; "Invite" sends the room invitation notification (POST /rooms/:id/invite). */
export const InviteFriendsModal: React.FC<{ open: boolean; roomId: string; onClose: () => void }> = ({ open, roomId, onClose }) => {
  const c = useTheme();
  const friends = useFriends();
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const items = friends.data?.items ?? [];

  const invite = async (friendId: string) => {
    setBusy(friendId);
    try {
      await roomApi.invite(roomId, friendId);
      setSent((s) => ({ ...s, [friendId]: true }));
      toast.success('Invitation sent');
    } catch (e) {
      toast.error('Could not invite', friendlyMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppModal open={open} title="Invite Friends" onClose={onClose}>
      {friends.isLoading ? (
        <ActivityIndicator color={c.accent} />
      ) : items.length === 0 ? (
        <EmptyState title="No friends yet" description="Add friends to invite them straight to your room." />
      ) : (
        <View style={{ gap: 8 }}>
          {items.map((f) => (
            <View key={f.friendshipId} style={styles.slot} testID={`invite-row-${f.user.id}`}>
              <AppAvatar avatarId={f.user.avatar} name={f.user.displayName} size="sm" status={f.user.online ? 'online' : 'offline'} />
              <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text, flex: 1 }]}>{f.user.displayName}</Text>
              <AppButton
                testID={`invite-${f.user.id}`}
                title={sent[f.user.id] ? 'Invited' : 'Invite'}
                size="md"
                variant="secondary"
                icon={sent[f.user.id] ? <Check size={14} color={c.success} /> : <Send size={14} color={c.text} />}
                disabled={!!sent[f.user.id]}
                loading={busy === f.user.id}
                onPress={() => void invite(f.user.id)}
              />
            </View>
          ))}
        </View>
      )}
    </AppModal>
  );
};

/** Shown when the server ended the room (`room:expired`). */
export const RoomEnded: React.FC<{ reason: 'EXPIRED' | 'CANCELLED'; onLeave: () => void }> = ({ reason, onLeave }) => (
  <ErrorState
    title={reason === 'EXPIRED' ? 'Room expired' : 'Room closed'}
    message={reason === 'EXPIRED' ? 'Nobody joined in time, so the room was closed.' : 'This room was cancelled.'}
    retryLabel="Back to Lobby"
    onRetry={onLeave}
  />
);

/** Copy text to the clipboard with a toast. */
export async function copyText(text: string, label: string): Promise<void> {
  try {
    await Clipboard.setStringAsync(text);
    toast.success(`${label} copied`, text);
  } catch {
    toast.error('Could not copy');
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
