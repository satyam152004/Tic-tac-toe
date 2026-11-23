import * as AppleAuthentication from 'expo-apple-authentication';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { ApiError } from './api/errors';

/**
 * Google / Apple sign-in. The native SDK returns an ID/identity token which the BACKEND verifies (`POST /auth/google`,
 * `POST /auth/apple`); the app never trusts the token itself. Provider availability depends on build configuration:
 *   - Google: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (+ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID on iOS); the backend needs the same web client id.
 *     Requires a development build (custom native module RNGoogleSignin). Not available in Expo Go.
 *   - Apple: iOS only (Sign in with Apple capability is enabled by app.config.ts).
 * A user cancelling throws Error('CANCELLED') which callers ignore silently.
 */
const GOOGLE_WEB = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
const GOOGLE_IOS = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();

/**
 * Check if the native RNGoogleSignin module is registered in the native binary.
 * In Expo Go, custom native modules are not bundled, so this returns false
 * and prevents TurboModuleRegistry.getEnforcing from throwing a fatal crash.
 */
export function isGoogleSigninSupported(): boolean {
  try {
    if (typeof TurboModuleRegistry !== 'undefined' && TurboModuleRegistry.get) {
      if (TurboModuleRegistry.get('RNGoogleSignin') != null) {
        return true;
      }
    }
    if (NativeModules && NativeModules.RNGoogleSignin != null) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function getGoogleSigninModule() {
  if (!isGoogleSigninSupported()) {
    throw new ApiError(
      'PROVIDER_NOT_AVAILABLE',
      'Google Sign-In is not supported in Expo Go. Please use a development build (npx expo run:android / ios) or build with EAS.',
    );
  }
  // Lazily require the module only when native binary contains RNGoogleSignin
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin');
}

export const socialProviders = {
  get google(): boolean {
    return GOOGLE_WEB.length > 0 && isGoogleSigninSupported();
  },
  apple: Platform.OS === 'ios',
};

let googleConfigured = false;
const cancelled = () => new Error('CANCELLED');

/** `upgradeGuest`: the signed-in guest becomes this Google/Apple account (keeps progress) instead of switching accounts. */
export interface SocialOptions {
  upgradeGuest?: boolean;
}

const finish = (provider: 'google' | 'apple', token: string, opts?: SocialOptions) =>
  opts?.upgradeGuest ? useAuthStore.getState().upgradeGuestSocial(provider, token) : useAuthStore.getState().social(provider, token);

export async function signInWithGoogle(opts?: SocialOptions): Promise<void> {
  if (!isGoogleSigninSupported()) {
    throw new ApiError(
      'PROVIDER_NOT_AVAILABLE',
      'Google Sign-In requires custom native code and is not supported in Expo Go. Please create a development build with `npx expo run:android` or EAS Build.',
    );
  }
  if (!GOOGLE_WEB.length) {
    throw new ApiError('PROVIDER_NOT_CONFIGURED', 'Google sign-in is not configured in this build.');
  }

  const { GoogleSignin, isErrorWithCode, statusCodes } = getGoogleSigninModule();

  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB, iosClientId: GOOGLE_IOS || undefined });
    googleConfigured = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') throw cancelled();
    const idToken = res.data.idToken;
    if (!idToken) throw new ApiError('INVALID_SOCIAL_TOKEN', 'Google did not return an identity token.');
    await finish('google', idToken, opts);
  } catch (e) {
    if (e instanceof Error && e.message === 'CANCELLED') throw e;
    const isObj = typeof e === 'object' && e !== null;
    const code = isObj && 'code' in e ? (e as { code?: unknown }).code : undefined;
    if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) throw cancelled();
    throw e;
  }
}

export async function signInWithApple(opts?: SocialOptions): Promise<void> {
  if (!socialProviders.apple) throw new ApiError('PROVIDER_NOT_CONFIGURED', 'Sign in with Apple is only available on iOS.');
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!cred.identityToken) throw new ApiError('INVALID_SOCIAL_TOKEN', 'Apple did not return an identity token.');
    await finish('apple', cred.identityToken, opts);
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw cancelled();
    throw e;
  }
}
