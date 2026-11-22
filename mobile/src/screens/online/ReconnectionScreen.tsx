import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ConfirmDialog } from '../../components/common/AppModal';
import { Screen } from '../../components/common/Screen';
import { fonts, type } from '../../design-system/typography';
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

const UNFINISHED = new Set(['IN_PROGRESS', 'READY', 'WAITING']);

export const ReconnectionScreen: React.FC<RootScreenProps<'reconnection'>> = ({ route }) => {
  const c = useTheme();
  const { nav, goHome } = useAppNav();
  const status = useSocketStatus();
  const paramGameId = route.params?.gameId;
  const [restoring, setRestoring] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [attempt, setAttempt] = useState(2);
  const done = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      setAttempt((a) => (a < 5 ? a + 1 : 1));
    }, 2500);
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
        toast.info('No active game', 'Your match is no longer running.');
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
          <AppButton
            testID="reconnect-retry"
            title="Retry Now"
            fullWidth
            loading={restoring}
            onPress={retry}
          />
          <AppButton
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
        <AppCard padding="lg" style={styles.card}>
          {/* Connection Lost Pill */}
          <View style={styles.lostPill}>
            <WifiOff size={13} color="#B45309" />
            <Text style={styles.lostPillText}>Connection Lost</Text>
          </View>

          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[styles.title, { color: c.text }]}>Reconnecting to Match...</Text>
            <Text style={[styles.sub, { color: c.textSecondary }]}>
              Attempt {attempt} of 5 • Room TTT-842
            </Text>
          </View>

          {/* Progress bar */}
          <View style={[styles.track, { backgroundColor: c.bgSecondary }]}>
            <View
              style={[
                styles.fill,
                { width: `${attempt * 20}%`, backgroundColor: c.accent },
              ]}
            />
          </View>
        </AppCard>
      </View>

      <ConfirmDialog
        open={confirmLeave}
        title="Leave the game?"
        message="Leaving forfeits this online match to your opponent."
        confirmLabel="Forfeit"
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
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 24,
  },
  lostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  lostPillText: {
    fontSize: 11,
    fontFamily: fonts.body.semibold,
    color: '#B45309',
  },
  title: {
    fontSize: 17,
    fontFamily: fonts.body.semibold,
  },
  sub: {
    fontSize: 12,
    fontFamily: fonts.mono.medium,
  },
  track: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 8,
  },
});
