import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';

/**
 * Asks for confirmation before the user leaves a screen with unsaved or active state (a running game, unsaved edits).
 * Covers the Android hardware back button, the iOS swipe-back gesture and header back buttons, because it hooks
 * React Navigation's `beforeRemove`. The question is shown in the app's own popup (ConfirmDialog), not the phone's alert.
 *
 * Usage: `const guard = useBackGuard({...})`, then render `<ConfirmDialog {...guard.dialog} />` on the screen.
 * Call `guard.allow()` before programmatic navigation (game finished -> result) so no prompt appears.
 */
export function useBackGuard(opts: { when: boolean; title: string; message: string; confirmLabel?: string; onLeave?: () => void }) {
  const nav = useNavigation();
  const allowed = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [pending, setPending] = useState<{ action: Parameters<typeof nav.dispatch>[0] } | null>(null);

  useEffect(
    () =>
      nav.addListener('beforeRemove', (e) => {
        const o = optsRef.current;
        if (allowed.current || !o.when) return;
        e.preventDefault();
        setPending({ action: e.data.action });
      }),
    [nav],
  );

  const confirm = () => {
    const p = pending;
    setPending(null);
    if (!p) return;
    allowed.current = true;
    optsRef.current.onLeave?.();
    nav.dispatch(p.action);
  };

  return {
    allow: () => void (allowed.current = true),
    reset: () => void (allowed.current = false),
    dialog: {
      open: pending !== null,
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'Leave',
      destructive: true,
      onConfirm: confirm,
      onCancel: () => setPending(null),
    },
  };
}
