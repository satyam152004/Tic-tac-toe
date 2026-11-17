import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** Lets non-component code (push taps, deep links, session expiry) navigate. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateTo<T extends keyof RootStackParamList>(name: T, params?: RootStackParamList[T]): boolean {
  if (!navigationRef.isReady()) return false;
  (navigationRef.navigate as (n: string, p?: unknown) => void)(name, params);
  return true;
}

export function currentRouteName(): string | undefined {
  return navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
}
