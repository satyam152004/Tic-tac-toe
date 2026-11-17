import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../store/settingsStore';

/**
 * Sound effects + haptics, both gated by the user's settings (sound effects / vibration).
 * Players are created lazily, reused, and failures never surface to the UI (feedback is a nicety).
 */
const SOURCES = {
  tap: require('../assets/sounds/tap.wav'),
  place_x: require('../assets/sounds/place_x.wav'),
  place_o: require('../assets/sounds/place_o.wav'),
  win: require('../assets/sounds/win.wav'),
  lose: require('../assets/sounds/lose.wav'),
  draw: require('../assets/sounds/draw.wav'),
  error: require('../assets/sounds/error.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const players = new Map<SoundName, AudioPlayer>();
let modeSet = false;

export function playSound(name: SoundName): void {
  if (!useSettingsStore.getState().soundEffects) return;
  try {
    if (!modeSet) {
      modeSet = true;
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
    }
    let p = players.get(name);
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      players.set(name, p);
    }
    void p.seekTo(0);
    p.play();
  } catch {
    /* audio unavailable: ignore */
  }
}

type HapticKind = 'light' | 'medium' | 'success' | 'warning' | 'error' | 'select';

export function haptic(kind: HapticKind = 'light'): void {
  if (!useSettingsStore.getState().vibration) return;
  try {
    switch (kind) {
      case 'light': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
      case 'medium': void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
      case 'select': void Haptics.selectionAsync(); break;
      case 'success': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
      case 'warning': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); break;
      case 'error': void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); break;
    }
  } catch {
    /* ignore */
  }
}

export const feedback = {
  place: (mark: 'X' | 'O') => {
    playSound(mark === 'X' ? 'place_x' : 'place_o');
    haptic('light');
  },
  result: (kind: 'win' | 'lose' | 'draw') => {
    playSound(kind);
    haptic(kind === 'win' ? 'success' : kind === 'lose' ? 'warning' : 'medium');
  },
  error: () => {
    playSound('error');
    haptic('error');
  },
  tap: () => {
    playSound('tap');
    haptic('select');
  },
};
