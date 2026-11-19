import { Platform, ViewStyle } from 'react-native';

/**
 * One restrained elevation for surfaces that float above content (toast, tab-bar Play button, menus).
 * Neutral black, no coloured glow. Cards and buttons are flat and are separated by borders instead.
 */
export const lift: ViewStyle =
  Platform.select<ViewStyle>({
    ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
    default: { elevation: 4 },
  }) ?? {};
