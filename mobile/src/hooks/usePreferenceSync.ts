import { useCallback } from 'react';
import { useUpdateProfile } from './queries';
import { friendlyMessage } from '../services/api/errors';
import type { UpdateMeInput } from '../services/api/userApi';
import { useAuthStore } from '../store/authStore';
import { SettingsState, useSettingsStore } from '../store/settingsStore';
import { toast } from '../store/toastStore';

type Patch = Partial<Omit<SettingsState, 'set'>>;

/**
 * Optimistic preference change: applies `patch` to the persisted settings store immediately (UI never waits),
 * then PATCHes the account in the background when signed in. On failure the previous values are restored
 * (only the keys that still hold the optimistic value, so a newer change is never clobbered) and a toast is shown.
 */
export function usePreferenceSync() {
  const update = useUpdateProfile();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const mutate = update.mutateAsync;

  return useCallback(
    (patch: Patch, remote?: UpdateMeInput): void => {
      const store = useSettingsStore.getState();
      const previous: Record<string, unknown> = {};
      (Object.keys(patch) as Array<keyof Patch>).forEach((k) => {
        previous[k] = store[k];
      });
      store.set(patch);
      if (!signedIn || !remote) return;
      mutate(remote).catch((e: unknown) => {
        const current = useSettingsStore.getState();
        const revert: Record<string, unknown> = {};
        (Object.keys(patch) as Array<keyof Patch>).forEach((k) => {
          if (current[k] === patch[k]) revert[k] = previous[k];
        });
        current.set(revert as Patch);
        toast.error("Couldn't save setting", friendlyMessage(e));
      });
    },
    [mutate, signedIn],
  );
}
