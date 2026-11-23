import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { ActionButton } from '../../components/game/ActionButton';
import { ConfirmDialog } from '../../components/common/AppModal';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import { gameApi } from '../../services/api/gameApi';
import { forfeitGame, openGame } from '../../services/onlineActions';
import { socketClient } from '../../services/socket/socketClient';
import { isTerminal, useOnlineStore } from '../../store/onlineStore';
import { toast } from '../../store/toastStore';
import { useSocketStatus } from './shared';

import { fs, ms } from '../../design-system/responsive';
const MAX_ATTEMPTS = 5;
const ATTEMPT_MS = 3000;
const UNFINISHED = new Set(['IN_PROGRESS', 'READY', 'WAITING']);

export const ReconnectionScreen: React.FC<RootScreenProps<'reconnection'>> = ({ route }) => {
  const c = useTheme();
  const { nav, goHome } = useAppNav();
  const status = useSocketStatus();
  const paramGameId = route.params?.gameId;
  const [restoring, setRestoring] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [attempt, setAttempt] = useState(1);
  const room = useOnlineStore((st) => st.room);
  const gameRoomId = useOnlineStore((st) => st.game?.roomId);
  const roomCode = room && room.id === gameRoomId ? room.code : null;
  const done = useRef(false);

  // Real retries: every few seconds without a connection the socket is asked to reconnect again (max 5 attempts).
  useEffect(() => {
    const t = setInterval(() => {
      if (socketClient.status === 'ready') return;
      setAttempt((n) => {
        if (n >= MAX_ATTEMPTS) return n;
        socketClient.connect();
        return n + 1;
      });
    }, ATTEMPT_MS);
    return () => clearInterval(t);
  }, []);

  const currentId = useCallback(async (): Promise<string | undefined> => {
    const id = paramGameId ?? useOnlineStore.getState().game?.id;
    if (id) return id;
    return (await gameApi.active()).find((g) => UNFINISHED.has(g.status))?.id;
  }, [paramGameId]);

  const restore = useCallback(async () => {
    if (done.current) return;
    done.current = true;
    setRestoring(true);
    try {
      const id = await currentId();
      if (!id) {
        toast.info('No active game', 'This match has ended.');
        goHome();
        return;
      }
      const g = await openGame(id);
      useOnlineStore.getState().setReconnecting(false);
      nav.replace(isTerminal(g) ? 'online_result' : 'online_board', { gameId: id });
    } catch {
      done.current = false;
      setRestoring(false);
    }
  }, [currentId, goHome, nav]);

  useEffect(() => {
    if (status === 'ready') void restore();
  }, [status, restore]);

  const retry = () => {
    setAttempt(1);
    socketClient.connect();
    if (socketClient.status === 'ready') void restore();
  };

  const leave = async () => {
    setConfirmLeave(false);
    try {
      const id = await currentId();
      if (id) await forfeitGame(id);
    } catch (e) {
      toast.error('Could not leave game', friendlyMessage(e));
    }
    useOnlineStore.getState().setReconnecting(false);
    goHome();
  };

  return (
    <Screen
      title=""
      onBack={goHome}
      scroll={false}
      padded={false}
      footer={
        <View style={styles.footer}>
          <ActionButton
            testID="reconnect-retry"
            title="Try again"
            fullWidth
            loading={restoring}
            onPress={retry}
          />
          <ActionButton
            testID="reconnect-leave"
            title="Leave Match"
            variant="danger"
            fullWidth
            onPress={() => setConfirmLeave(true)}
          />
        </View>
      }
    >
      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {/* Connection Lost Pill */}
          <View style={styles.lostPill}>
            <WifiOff size={ms(16)} color="#B45309" />
            <Text style={styles.lostPillText}>Connection lost</Text>
          </View>

          <View style={{ alignItems: 'center', gap: ms(4) }}>
            <Text style={[styles.title, { color: c.text }]}>Reconnecting to Match...</Text>
            <Text style={[styles.sub, { color: c.textSecondary }]}>
              Attempt {attempt} of {MAX_ATTEMPTS}{roomCode ? ` • Room ${roomCode}` : ''}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={[styles.track, { backgroundColor: c.bgSecondary }]}>
            <View
              style={[
                styles.fill,
                { width: `${(attempt / MAX_ATTEMPTS) * 100}%`, backgroundColor: c.accent },
              ]}
            />
          </View>
        </View>
      </View>

      <ConfirmDialog
        open={confirmLeave}
        title="Leave the game?"
        message="If you leave, your opponent wins."
        confirmLabel="Leave match"
        cancelLabel="Keep waiting"
        destructive
        onConfirm={leave}
        onCancel={() => setConfirmLeave(false)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: ms(20),
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    gap: ms(12),
    padding: ms(16),
    borderRadius: ms(14),
    borderWidth: 1,
  },
  lostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    paddingHorizontal: ms(10),
    paddingVertical: ms(2),
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  lostPillText: {
    fontSize: fs(10.5),
    fontFamily: fonts.body.semibold,
    color: '#B45309',
  },
  title: {
    fontSize: fs(17),
    fontFamily: fonts.body.semibold,
  },
  sub: {
    fontSize: fs(12),
    fontFamily: fonts.body.regular,
  },
  track: {
    width: '100%',
    height: ms(7.2),
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  footer: {
    paddingHorizontal: ms(20),
    paddingTop: ms(8),
    paddingBottom: ms(16),
    gap: ms(8),
  },
});
