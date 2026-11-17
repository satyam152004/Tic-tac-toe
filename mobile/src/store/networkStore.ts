import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

interface NetworkState {
  /** null until the first reading arrives. `internetReachable === false` also counts as offline (captive portals). */
  online: boolean | null;
  start: () => () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  online: null,
  start: () => {
    const unsub = NetInfo.addEventListener((s) => set({ online: s.isConnected === false || s.isInternetReachable === false ? false : true }));
    return unsub;
  },
}));
