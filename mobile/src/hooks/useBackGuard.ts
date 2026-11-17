import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

/**
 * Asks for confirmation before the user leaves a screen with unsaved/active state (a running game).
 * Covers the Android hardware back button, the iOS swipe-back gesture and header back buttons because it
 * hooks React Navigation's `beforeRemove`. Navigation triggered by the app after `allow()` is let through.
 */
export function useBackGuard(opts: { when: boolean; title: string; message: string; confirmLabel?: string; onLeave?: () => void }) {
  const nav = useNavigation();
  const allowed = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(
    () =>
      nav.addListener('beforeRemove', (e) => {
        const o = optsRef.current;
        if (allowed.current || !o.when) return;
        e.preventDefault();
        Alert.alert(o.title, o.message, [
          { text: 'Stay', style: 'cancel' },
          {
            text: o.confirmLabel ?? 'Leave',
            style: 'destructive',
            onPress: () => {
              allowed.current = true;
              o.onLeave?.();
              nav.dispatch(e.data.action);
            },
          },
        ]);
      }),
    [nav],
  );

  /** Call before programmatic navigation (e.g. game finished -> result screen) so no prompt appears. */
  return { allow: () => void (allowed.current = true), reset: () => void (allowed.current = false) };
}
