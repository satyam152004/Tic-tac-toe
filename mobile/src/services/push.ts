import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { userApi } from './api/userApi';
import { useSettingsStore } from '../store/settingsStore';

/**
 * Push notifications (FCM). The backend sends through Firebase Cloud Messaging, so it needs an FCM registration token:
 *  - Android: `getDevicePushTokenAsync()` returns the FCM token -> registered with `POST /devices/register`.
 *  - iOS: the native token is an APNs token, which the backend (FCM) cannot use without the Firebase iOS SDK. iOS devices
 *    therefore rely on the realtime socket notifications while the app is open (see docs/SETUP: "iOS push").
 * Foreground notifications are shown as in-app toasts by the socket bridge, so the OS banner is suppressed while open.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

let registeredId: string | null = null;

export async function registerForPush(): Promise<void> {
  if (!Device.isDevice || Platform.OS !== 'android') return;
  if (!useSettingsStore.getState().notifications) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Game & social', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const perm = await Notifications.getPermissionsAsync();
    const granted = perm.granted || (perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return;
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (typeof token !== 'string' || token.length < 20) return;
    const res = await userApi.registerDevice(token, 'android', Device.modelName ?? undefined);
    registeredId = res.id;
  } catch {
    /* push is best effort: never block the app */
  }
}

export async function unregisterPush(): Promise<void> {
  if (!registeredId) return;
  const id = registeredId;
  registeredId = null;
  await userApi.removeDevice(id).catch(() => undefined);
}
