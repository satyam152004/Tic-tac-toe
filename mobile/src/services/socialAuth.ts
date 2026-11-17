import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { ApiError } from './api/errors';

/**
 * Google / Apple sign-in. The native SDK returns an ID/identity token which the BACKEND verifies (`POST /auth/google`,
 * `POST /auth/apple`); the app never trusts the token itself. Provider availability depends on build configuration:
 *   - Google: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (+ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID on iOS); the backend needs the same web client id.
 *   - Apple: iOS only (Sign in with Apple capability is enabled by app.config.ts).
 * A user cancelling throws Error('CANCELLED') which callers ignore silently.
 */
const GOOGLE_WEB = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
const GOOGLE_IOS = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();

export const socialProviders = {
  google: GOOGLE_WEB.length > 0,
  apple: Platform.OS === 'ios',
};

let googleConfigured = false;
const cancelled = () => new Error('CANCELLED');

export async function signInWithGoogle(): Promise<void> {
  if (!socialProviders.google) throw new ApiError('PROVIDER_NOT_CONFIGURED', 'Google sign-in is not configured in this build.');
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
    await useAuthStore.getState().social('google', idToken);
  } catch (e) {
    if (e instanceof Error && e.message === 'CANCELLED') throw e;
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) throw cancelled();
    throw e;
  }
}

export async function signInWithApple(): Promise<void> {
  if (!socialProviders.apple) throw new ApiError('PROVIDER_NOT_CONFIGURED', 'Sign in with Apple is only available on iOS.');
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!cred.identityToken) throw new ApiError('INVALID_SOCIAL_TOKEN', 'Apple did not return an identity token.');
    await useAuthStore.getState().social('apple', cred.identityToken);
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw cancelled();
    throw e;
  }
}
