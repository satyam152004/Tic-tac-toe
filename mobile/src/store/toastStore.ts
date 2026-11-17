import { create } from 'zustand';

export interface ToastData {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

interface ToastState {
  toast: ToastData | null;
  show: (type: ToastData['type'], title: string, message?: string) => void;
  dismiss: () => void;
}

let seq = 0;
export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (type, title, message) => set({ toast: { id: ++seq, type, title, message } }),
  dismiss: () => set({ toast: null }),
}));

export const toast = {
  success: (t: string, m?: string) => useToastStore.getState().show('success', t, m),
  error: (t: string, m?: string) => useToastStore.getState().show('error', t, m),
  warning: (t: string, m?: string) => useToastStore.getState().show('warning', t, m),
  info: (t: string, m?: string) => useToastStore.getState().show('info', t, m),
};
