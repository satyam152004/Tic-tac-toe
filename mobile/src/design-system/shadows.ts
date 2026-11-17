import { Platform, ViewStyle } from 'react-native';

/** Used sparingly: only for the primary button, the active player and winning cells (as in the prototype). */
export const glow = (color: string, opacity = 0.3, radius = 12): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: 4 } },
    default: { elevation: 4, shadowColor: color },
  }) ?? {};
