import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Density, SCREEN_SPACE, estimateBoardArea } from '../components/game/boardLayout';

/**
 * Layout inputs for a game screen from the live window: density (compact on short screens or large system fonts),
 * the screen gutter / gap for that density, whether the controls stack for large fonts, and a first-frame estimate of
 * the board area (replaced by the measured area once the board region has been laid out).
 */
export function useGameLayout(): {
  density: Density;
  gutter: number;
  gap: number;
  fontScale: number;
  stackedControls: boolean;
  estimate: { width: number; height: number };
} {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const e = estimateBoardArea({ windowWidth: width, windowHeight: height, insetTop: insets.top, insetBottom: insets.bottom, fontScale });
  return { density: e.density, ...SCREEN_SPACE[e.density], fontScale, stackedControls: e.stackedControls, estimate: { width: e.width, height: e.height } };
}
