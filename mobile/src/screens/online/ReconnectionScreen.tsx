import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RefreshCw, WifiOff } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ConfirmDialog } from '../../components/common/AppModal';
import { Screen } from '../../components/common/Screen';
import { AppLoader } from '../../components/feedback/AppLoader';
import { type } from '../../design-system/typography';
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

/** Shown while the socket is down during a live game; restores the latest SERVER state once the session is ready. */
export const ReconnectionScreen: React.FC<RootScreenProps<'reconnection'>> = ({ route }) => {
  const c = useTheme();
  const { nav, goHome } = useAppNav();
  const status = useSocketStatus();
  const paramGameId = route.params?.gameId;
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
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
    setError(null);
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
    } catch (e) {
      done.current = false;
      setError(friendlyMessage(e));
      setRestoring(false);
    }
  }, [currentId, goHome, nav]);

  useEffect(() => {
    if (status === 'ready') void restore();
  }, [status, restore]);

  const retry = () => {
    setError(null);
    socketClient.connect(); // idempotent
    if (socketClient.status === 'ready') void restore();
  };

  const leave = async () => {
    setConfirmLeave(false);
    try {
      const id = await currentId();
      if (id) await forfeitGame(id);
    } catch (e) {
      toast.error('Could not leave the game', friendlyMessage(e));
    }
    useOnlineStore.getState().setReconnecting(false);
    goHome();
  };

  return (
    <Screen title="Connection" onBack={goHome}>
      <View style={styles.center}>
        <AppCard padding="lg" style={{ gap: 18, alignItems: 'center' }}>
          <View style={[styles.icon, { backgroundColor: c.warning + '26', borderColor: c.warning + '66' }]}>
            <WifiOff size={28} color={c.warning} />
          </View>
          <Text style={[type.headline, { color: c.text, textAlign: 'center' }]}>{status === 'ready' ? 'Connected' : 'Connection Lost'}</Text>
          <Text style={[type.small, { color: c.textSecondary, textAlign: 'center' }]}>
            We are restoring your live match. If you stay offline too long your opponent can win by disconnect.
          </Text>
          <AppLoader label={restoring ? 'Syncing move state...' : status === 'closed' ? 'Disconnected' : 'Reconnecting...'} sublabel={`${elapsed}s`} />
          {error ? <Text testID="reconnect-error" style={[type.small, { color: '#F87171', textAlign: 'center' }]}>{error}</Text> : null}
          <View style={{ alignSelf: 'stretch', gap: 10 }}>
            <AppButton testID="reconnect-retry" title="Retry & Return to Match" fullWidth icon={<RefreshCw size={16} color="#FFFFFF" />} loading={restoring} onPress={retry} />
            <AppButton testID="reconnect-leave" title="Leave Game" variant="outline" fullWidth onPress={() => setConfirmLeave(true)} />
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
  center: { flex: 1, justifyContent: 'center', paddingVertical: 24 },
  icon: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
