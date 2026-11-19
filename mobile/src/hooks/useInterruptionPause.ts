import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useLocalGameStore } from '../store/localGameStore';

/**
 * Pauses a running offline game whenever the app stops being the foreground app: home button, app switcher,
 * screen lock, incoming call (`background`), or iOS control centre / system alert (`inactive`).
 *
 * It deliberately never resumes. When the player comes back the board shows its in-game Resume overlay and they
 * choose when to continue, so the clock never runs while nobody is looking.
 *
 * Not tied to the signed-in state: guests play offline too. Pausing is idempotent in the store, so repeated or
 * overlapping events (inactive then background) are harmless.
 */
export function useInterruptionPause(): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') useLocalGameStore.getState().pause('interrupted');
    });
    return () => sub.remove();
  }, []);
}
