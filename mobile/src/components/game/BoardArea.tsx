import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { GameBoard, GameBoardProps } from './GameBoard';
import { fitBoard, minBoardSide } from './boardLayout';

/**
 * The flexible part of the game screen: it takes whatever height the fixed parts leave, and the board is sized to fit
 * it (see `fitBoard`). The board is positioned absolutely inside the area so the area's own height never depends on the
 * board, which lets the board shrink to fit instead of forcing the page taller. The area has a `minHeight` of the
 * smallest board that keeps 44dp cells; when the screen is shorter than that, the screen scrolls.
 *
 * Until the first layout the board uses `initial` (an estimate from the window size), so there is no empty first frame.
 */
export const BoardArea: React.FC<
  Omit<GameBoardProps, 'side'> & { initial: { width: number; height: number } }
> = ({ initial, size, maxSize, ...board }) => {
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  };
  const a = area ?? initial;
  const { side } = fitBoard({ areaWidth: a.width, areaHeight: a.height, size, maxSize });

  return (
    <View testID="board-area" onLayout={onLayout} style={[styles.area, { minHeight: minBoardSide(size) }]}>
      <View style={styles.center} pointerEvents="box-none">
        <GameBoard {...board} size={size} side={side} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // flexGrow, not flex: 1. Inside a ScrollView a flex-basis of 0 collapses; the area grows to the leftover space instead.
  area: { flexGrow: 1, alignSelf: 'stretch' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
