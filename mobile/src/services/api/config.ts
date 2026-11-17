import { Platform } from 'react-native';

/**
 * Environment-specific backend URL. NEVER hard-code `localhost`: on a phone it points at the phone itself.
 *
 *  - Set EXPO_PUBLIC_API_URL per build profile (see eas.json / .env.example), e.g. http://192.168.1.20:4000 for a
 *    physical device on your LAN, or https://api.your-domain.com for staging/production.
 *  - Fallbacks (development only): Android emulator -> 10.0.2.2 (host alias), iOS simulator -> localhost.
 *  - Release builds refuse a non-HTTPS URL, so credentials can never travel over cleartext by accident.
 */
const DEFAULT_DEV_URL = Platform.select({ android: 'http://10.0.2.2:4000', default: 'http://localhost:4000' }) as string;

export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '') || DEFAULT_DEV_URL;
export const API_BASE = `${API_URL}/api/v1`;
export const SOCKET_URL = API_URL;
export const REQUEST_TIMEOUT_MS = 15_000;

if (!__DEV__ && !API_URL.startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_API_URL must be an https:// URL in release builds');
}
