import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Copy, Share2 } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { ErrorState } from '../../components/feedback/StateViews';
import { fonts, type } from '../../design-system/typography';
import { formatClock, useCountdown } from '../../hooks/useOnlineGame';
import { useBackGuard } from '../../hooks/useBackGuard';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import { leaveRoom, setReady, startRoomGame } from '../../services/onlineActions';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { copyText, isOfflineError, RoomEnded, shareRoomCode, useRoom } from './shared';

export const WaitingRoomScreen: React.FC<RootScreenProps<'waiting_room'>> = ({ route }) => {
  const c = useTheme();
  const { roomId } = route.params;
  const { nav, goHome } = useAppNav();
  const meId = useAuthStore((s) => s.user?.id);
  const { room, ended, loading, error, retry } = useRoom(roomId);
  const [busy, setBusy] = useState<'ready' | 'start' | null>(null);
  const left = useCountdown(room ? Date.parse(room.expiresAt) : null);
  const moved = useRef(false);

  const isHost = !!room && room.hostId === meId;
  const live = !!room && !ended && !room.gameId;
  const guard = useBackGuard({
    when: live,
    title: 'Leave room?',
    message: isHost ? 'Leaving closes the room.' : 'You will leave this room.',
    confirmLabel: 'Leave room',
    onLeave: () => void leaveRoom(roomId).catch(() => undefined),
  });

  useEffect(() => {
    if (room?.gameId && !moved.current) {
      moved.current = true;
      guard.allow();
      nav.replace('online_board', { gameId: room.gameId });
    }
  }, [room?.gameId, guard, nav]);

  const toLobby = () => {
    guard.allow();
    goHome();
  };

  const leave = async () => {
    guard.allow();
    try {
      await leaveRoom(roomId);
    } catch (e) {
      toast.error('Could not leave room', friendlyMessage(e));
    }
    nav.replace('online_lobby');
  };

  const toggleReady = async () => {
    if (!room || busy) return;
    setBusy('ready');
    try {
      await setReady(room.id, !room.guestReady);
    } catch (e) {
      toast.error('Could not update', friendlyMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const start = async () => {
    if (!room || busy) return;
    setBusy('start');
    try {
      const game = await startRoomGame(room.id);
      moved.current = true;
      guard.allow();
      nav.replace('online_board', { gameId: game.id });
    } catch (e) {
      toast.error('Could not start match', friendlyMessage(e));
      setBusy(null);
    }
  };

  if (ended) return <Screen title="Waiting Room" onBack={toLobby}><RoomEnded reason={ended} onLeave={toLobby} /></Screen>;
  if (error && !room) return <Screen title="Waiting Room" onBack={toLobby}><ErrorState offline={isOfflineError(error)} message={friendlyMessage(error)} onRetry={retry} /></Screen>;
  if (loading || !room) return <Screen title="Waiting Room" onBack={toLobby}><AppLoader label="Loading room..." /></Screen>;

  const guestPresent = !!room.guest;
  const codeDisplay = room.code.length >= 3 ? `${room.code.slice(0, 3)}-${room.code.slice(3)}` : room.code;

  return (
    <Screen
      title="Waiting Room"
      onBack={leave}
      footer={
        <View style={{ gap: 8 }}>
          {isHost ? (
            <AppButton
              testID="start-match"
              title="Start Match"
              fullWidth
              loading={busy === 'start'}
              disabled={!guestPresent || !room.guestReady}
              onPress={start}
            />
          ) : (
            <AppButton
              testID="ready-toggle"
              title={room.guestReady ? 'Not Ready' : 'Ready'}
              variant={room.guestReady ? 'secondary' : 'primary'}
              fullWidth
              loading={busy === 'ready'}
              onPress={toggleReady}
            />
          )}
          <AppButton
            testID="leave-room"
            title={isHost ? 'Cancel Room' : 'Leave Room'}
            variant={isHost ? 'danger' : 'outline'}
            fullWidth
            onPress={leave}
          />
        </View>
      }
    >
      <View style={{ gap: 14 }}>
        {/* Room Code Card */}
        <AppCard padding="md" style={styles.codeCard}>
          <Text style={[styles.codeTag, { color: c.textSecondary }]}>ROOM CODE</Text>
          <Text style={[styles.codeValue, { color: c.text }]}>{codeDisplay}</Text>
          <View style={styles.codeActions}>
            <Pressy
              testID="copy-code"
              accessibilityLabel="Copy room code"
              onPress={() => void copyText(room.code, 'Room code')}
              style={[styles.codeBtn, { backgroundColor: '#EFF4FF' }]}
            >
              <Copy size={14} color="#1D4ED8" />
              <Text style={[styles.codeBtnText, { color: '#1D4ED8' }]}>Copy</Text>
            </Pressy>

            <Pressy
              testID="share-code"
              accessibilityLabel="Share room code"
              onPress={() => void shareRoomCode(room)}
              style={[styles.codeBtn, { backgroundColor: '#F1F1EE' }]}
            >
              <Share2 size={14} color={c.text} />
              <Text style={[styles.codeBtnText, { color: c.text }]}>Share</Text>
            </Pressy>
          </View>
          {left !== null ? (
            <Text testID="room-expiry" style={[type.caption, { color: left < 60 ? c.warning : c.textSecondary, marginTop: 2 }]}>
              Expires in {formatClock(left)}
            </Text>
          ) : null}
        </AppCard>

        {/* Player Slots Group */}
        <View style={[styles.slotsGroup, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {/* Host Slot */}
          <View style={[styles.slotRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                <Text style={styles.avatarText}>
                  {room.host?.displayName ? room.host.displayName.slice(0, 2).toUpperCase() : 'H'}
                </Text>
              </View>
              <Text style={[styles.slotName, { color: c.text }]}>
                {room.host?.displayName ?? 'Host'} (Host • X)
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#F0FDF4' }]}>
              <Text style={[styles.badgeText, { color: '#15803D' }]}>Ready</Text>
            </View>
          </View>

          {/* Guest / Waiting Slot */}
          <View style={styles.slotRow}>
            {guestPresent ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.avatar, { backgroundColor: '#141518' }]}>
                    <Text style={styles.avatarText}>
                      {room.guest?.displayName ? room.guest.displayName.slice(0, 2).toUpperCase() : 'G'}
                    </Text>
                  </View>
                  <Text style={[styles.slotName, { color: c.text }]}>
                    {room.guest?.displayName ?? 'Opponent'} (Guest • O)
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: room.guestReady ? '#F0FDF4' : '#EFF4FF' }]}>
                  <Text style={[styles.badgeText, { color: room.guestReady ? '#15803D' : c.accent }]}>
                    {room.guestReady ? 'Ready' : 'Joining...'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.avatarEmpty}>
                    <Text style={[styles.avatarEmptyText, { color: c.textSecondary }]}>?</Text>
                  </View>
                  <Text style={[styles.slotName, { color: c.textSecondary }]}>
                    Waiting for opponent...
                  </Text>
                </View>
                <View style={[styles.pulsingDot, { backgroundColor: c.accent }]} />
              </>
            )}
          </View>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  codeCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  codeTag: {
    fontSize: 10,
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  codeValue: {
    fontSize: 24,
    fontFamily: fonts.mono.semibold,
    letterSpacing: 2,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  codeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeBtnText: {
    fontSize: 11.5,
    fontFamily: fonts.body.semibold,
  },
  slotsGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontFamily: fonts.mono.semibold,
    color: '#FFFFFF',
  },
  avatarEmpty: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFCFC8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmptyText: {
    fontSize: 12,
    fontFamily: fonts.mono.semibold,
  },
  slotName: {
    fontSize: 12.5,
    fontFamily: fonts.body.semibold,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10.5,
    fontFamily: fonts.body.semibold,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
