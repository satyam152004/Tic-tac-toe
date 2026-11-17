import { Platform } from 'react-native';

/**
 * Environment specific API URL. NEVER hard-code `localhost`: on a phone it points at the phone itself.
 *
 *  - Android emulator  -> http://10.0.2.2:4000        (alias of the host machine)
 *  - iOS simulator     -> http://localhost:4000       (shares the host network)
 *  - Physical devices  -> http://<your-LAN-IP>:4000   (e.g. 192.168.1.20) or an HTTPS tunnel / staging URL
 *  - Production        -> https://api.example.com     (HTTPS/WSS only: iOS ATS & Android block cleartext)
 *
 * Wire `APP_ENV` / `API_URL` through react-native-config (or Expo `extra` / EAS env) per build variant:
 *   .env.development  API_URL=http://192.168.1.20:4000
 *   .env.staging      API_URL=https://staging-api.example.com
 *   .env.production   API_URL=https://api.example.com
 */
import Config from 'react-native-config';

const DEFAULT_DEV_URL = Platform.select({ android: 'http://10.0.2.2:4000', default: 'http://localhost:4000' });

export const API_URL: string = (Config.API_URL && Config.API_URL.trim()) || DEFAULT_DEV_URL!;
export const API_BASE = `${API_URL}/api/v1`;
export const SOCKET_URL = API_URL; // same origin; Socket.IO connects to /socket.io automatically
export const REQUEST_TIMEOUT_MS = 15_000;

if (!__DEV__ && !API_URL.startsWith('https://')) {
  // Fail loudly in release builds instead of silently sending credentials over cleartext.
  throw new Error('API_URL must be https:// in production builds');
}
