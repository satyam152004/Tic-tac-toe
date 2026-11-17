import { CommonActions } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { navigateTo, navigationRef } from '../navigation/navigationRef';
import { queryClient } from '../services/queryClient';
import { flushPendingLink, startDeepLinks } from '../services/deepLinks';
import { syncLocalMatches } from '../services/localSync';
import { registerForPush } from '../services/push';
import { attachSession } from '../services/socket/sessionBridge';
import { socketClient } from '../services/socket/socketClient';
import { useAuthStore } from '../store/authStore';
import { useLocalGameStore } from '../store/localGameStore';
import { useNetworkStore } from '../store/networkStore';
import { isTerminal, useOnlineStore } from '../store/onlineStore';
import { toast } from '../store/toastStore';

/** Seconds in the background before an idle socket is closed to save battery (reconnects on foreground). */
const BACKGROUND_SOCKET_GRACE_MS = 90_000;

function routeFromNotification(data: Record<string, unknown> | undefined): void {
  const type = String(data?.type ?? '');
  const gameId = typeof data?.gameId === 'string' ? data.gameId : undefined;
  const roomCode = typeof data?.roomCode === 'string' ? data.roomCode : undefined;
  if (type === 'GAME_INVITE' && (gameId || roomCode)) navigateTo('match_invitation', { gameId, roomCode });
  else if ((type === 'REMATCH_REQUEST' || type === 'MATCH_FOUND') && gameId) navigateTo('online_board', { gameId });
  else if (type === 'FRIEND_REQUEST' || type === 'FRIEND_ACCEPTED') navigationRef.isReady() && navigationRef.dispatch(CommonActions.navigate('Main', { screen: 'FriendsTab' }));
  else if (type === 'ACHIEVEMENT_UNLOCKED') navigateTo('achievements');
  else navigateTo('notifications');
}

/**
 * App-level side effects, mounted once inside the NavigationContainer:
 * network watcher, session (socket + realtime bridge + push + offline sync) tied to the sign-in state, foreground/background
 * handling, deep links, notification taps and "session ended" handling.
 */
export function useAppLifecycle(): void {
  const status = useAuthStore((s) => s.status);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const historyVersion = useLocalGameStore((s) => s.historyVersion);
  const online = useNetworkStore((s) => s.online);
  const bgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Network + deep links + notification taps: app lifetime
  useEffect(() => {
    const stopNet = useNetworkStore.getState().start();
    const stopLinks = startDeepLinks();
    const tap = Notifications.addNotificationResponseReceivedListener((r) => routeFromNotification(r.notification.request.content.data as Record<string, unknown>));
    return () => {
      stopNet();
      stopLinks();
      tap.remove();
    };
  }, []);

  // Session lifetime: everything tied to being signed in
  useEffect(() => {
    if (status !== 'signedIn') return;
    const detach = attachSession();
    void registerForPush();
    void syncLocalMatches();
    flushPendingLink();
    return detach;
  }, [status]);

  // A finished offline match or regained connectivity -> try to sync history to the account
  useEffect(() => {
    if (status === 'signedIn' && online !== false) void syncLocalMatches();
  }, [status, historyVersion, online]);

  // Regained connectivity: reconnect the socket and refresh server data
  useEffect(() => {
    if (status !== 'signedIn' || online !== true) return;
    socketClient.connect();
    void queryClient.invalidateQueries();
    const cur = useOnlineStore.getState().game;
    if (cur && !isTerminal(cur)) useOnlineStore.getState().setReconnecting(true);
  }, [status, online]);

  // Foreground / background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (status !== 'signedIn') return;
      if (next === 'active') {
        if (bgTimer.current) clearTimeout(bgTimer.current);
        bgTimer.current = null;
        socketClient.connect(); // idempotent
        void useAuthStore.getState().refreshUser();
        void queryClient.invalidateQueries();
        void syncLocalMatches();
        // A running local game is paused while the app was in the background (timer fairness)
        flushPendingLink();
      } else if (next === 'background') {
        const local = useLocalGameStore.getState();
        if (local.game && local.game.outcome.status === 'IN_PROGRESS' && !local.paused) local.pause();
        bgTimer.current = setTimeout(() => {
          const g = useOnlineStore.getState().game;
          if (!g || isTerminal(g)) socketClient.disconnect(); // idle: save battery. Never while an online game is running.
        }, BACKGROUND_SOCKET_GRACE_MS);
      }
    });
    return () => {
      sub.remove();
      if (bgTimer.current) clearTimeout(bgTimer.current);
    };
  }, [status]);

  // Server ended the session (revoked / expired refresh token) -> back to welcome with an explanation
  useEffect(() => {
    if (!sessionExpired) return;
    toast.warning('Signed out', 'Your session ended. Please sign in again.');
    if (navigationRef.isReady()) navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'welcome' }] }));
    useAuthStore.getState().clearSessionExpired();
  }, [sessionExpired]);
}
