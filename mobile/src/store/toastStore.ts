import { create } from 'zustand';

export interface ToastData {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

/** How long a toast stays on screen. */
export const TOAST_DURATION_MS = 3500;

interface ToastState {
  toast: ToastData | null;
  /**
   * Number of native overlays (RN `<Modal>`, modal-presented screens) that currently host their own toast layer.
   * A native overlay is a separate window that always draws above the app root, so while one is open the root
   * host stays hidden and the overlay renders the toast instead. See `components/feedback/AppToast.tsx`.
   */
  overlayCount: number;
  show: (type: ToastData['type'], title: string, message?: string) => void;
  dismiss: () => void;
  /** Register an overlay that renders the toast. Returns the unregister function. */
  pushOverlay: () => () => void;
}

let seq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

const clearTimer = () => {
  if (timer) clearTimeout(timer);
  timer = null;
};

/**
 * The auto-dismiss timer lives here, not in a view: the toast can move between the root host and an overlay
 * without its lifetime restarting or being cut short.
 */
export const useToastStore = create<ToastState>((set, get) => ({
  toast: null,
  overlayCount: 0,

  show: (type, title, message) => {
    const cur = get().toast;
    const same = !!cur && cur.type === type && cur.title === title && cur.message === message;
    // An identical toast that is already visible is not stacked or re-animated: only its timer is extended.
    if (!same) set({ toast: { id: ++seq, type, title, message } });
    clearTimer();
    timer = setTimeout(() => get().dismiss(), TOAST_DURATION_MS);
  },

  dismiss: () => {
    clearTimer();
    set({ toast: null });
  },

  pushOverlay: () => {
    set((s) => ({ overlayCount: s.overlayCount + 1 }));
    let released = false;
    return () => {
      if (released) return;
      released = true;
      set((s) => ({ overlayCount: Math.max(0, s.overlayCount - 1) }));
    };
  },
}));

export const toast = {
  success: (t: string, m?: string) => useToastStore.getState().show('success', t, m),
  error: (t: string, m?: string) => useToastStore.getState().show('error', t, m),
  warning: (t: string, m?: string) => useToastStore.getState().show('warning', t, m),
  info: (t: string, m?: string) => useToastStore.getState().show('info', t, m),
};
