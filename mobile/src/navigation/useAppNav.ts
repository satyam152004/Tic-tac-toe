import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import type { MainTabParamList, RootStackParamList } from './types';

export type AppNavigation = NativeStackNavigationProp<RootStackParamList>;

/**
 * Navigation helpers shared by all screens.
 *  - push(): navigate() de-duplicates: pressing a button twice never stacks the same screen twice
 *  - goTab(): switches the bottom tab (the tab host stays mounted)
 *  - resetTo(): replaces the entire history (used after login/logout and after a finished game)
 */
export function useAppNav() {
  const nav = useNavigation<AppNavigation>();
  return useMemo(
    () => ({
      nav,
      goTab: (tab: keyof MainTabParamList) => nav.navigate('Main', { screen: tab } as never),
      goHome: () => nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'HomeTab' } }] })),
      resetTo: (name: keyof RootStackParamList, params?: object) => nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name, params }] })),
      back: () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Main', { screen: 'HomeTab' } as never)),
    }),
    [nav],
  );
}
