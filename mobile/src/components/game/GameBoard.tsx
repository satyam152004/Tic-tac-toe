import React, { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { radius } from '../../design-system/radius';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from '../common/Pressy';
import { SymbolMark } from './SymbolMark';

export type BoardCell = 'X' | 'O' | '' | null;

const GAP: Record<number, number> = { 3: 10, 4: 8, 5: 6 };
const PAD: Record<number, number> = { 3: 14, 4: 12, 5: 10 };

interface CellProps {
  index: number;
  value: BoardCell;
  side: number;
  glyph: number;
  winning: boolean;
  last: boolean;
  disabled: boolean;
  compact: boolean;
  corner: number;
  onPress: (i: number) => void;
}

const Cell = memo(function Cell({ index, value, side, glyph, winning, last, disabled, compact, corner, onPress }: CellProps) {
  const c = useTheme();
  const filled = value === 'X' || value === 'O';
  return (
    <Pressy
      testID={`cell-${index}`}
      accessibilityLabel={`Cell ${index + 1}${filled ? ` marked ${value}` : ' empty'}`}
      accessibilityState={{ disabled: disabled || filled }}
      disabled={disabled || filled}
      onPress={() => onPress(index)}
      scaleTo={0.95}
      style={{
        width: side,
        height: side,
        borderRadius: corner,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: winning ? c.accent + '40' : last ? c.bgElevated : c.bgSecondary,
        borderColor: winning ? c.accent : last ? c.accent + '99' : c.border,
        ...(winning ? { shadowColor: c.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 4 } : null),
      }}
    >
      {filled ? <SymbolMark value={value as 'X' | 'O'} size={glyph} glow={!compact} /> : null}
    </Pressy>
  );
});

/**
 * Square, width-driven board that works for 3x3, 4x4 and 5x5 on any screen size: the side is the
 * smaller of the available width and `maxSize`, so nothing overflows or shifts when marks appear.
 */
export const GameBoard: React.FC<{
  board: BoardCell[];
  size: 3 | 4 | 5;
  winningLine?: number[] | null;
  lastMoveIndex?: number | null;
  disabled?: boolean;
  compact?: boolean;
  maxSize?: number;
  onCellPress?: (index: number) => void;
}> = ({ board, size, winningLine = null, lastMoveIndex = null, disabled = false, compact = false, maxSize = 340, onCellPress }) => {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const outer = Math.min(width - 40, maxSize);
  const gap = compact ? 4 : GAP[size];
  const pad = compact ? 8 : PAD[size];
  const cell = Math.floor((outer - pad * 2 - gap * (size - 1)) / size);
  const glyph = Math.round(cell * 0.62);
  const corner = size === 3 ? 16 : 12;
  const winSet = useMemo(() => new Set(winningLine ?? []), [winningLine]);

  return (
    <View
      accessibilityLabel={`${size} by ${size} game board`}
      style={[styles.board, { width: outer, backgroundColor: c.bgCard, borderColor: c.border, padding: pad, gap }]}
    >
      {Array.from({ length: size }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {Array.from({ length: size }, (_, col) => {
            const i = r * size + col;
            return (
              <Cell
                key={i}
                index={i}
                value={board[i] ?? ''}
                side={cell}
                glyph={glyph}
                winning={winSet.has(i)}
                last={lastMoveIndex === i}
                disabled={disabled}
                compact={compact}
                corner={corner}
                onPress={(idx) => onCellPress?.(idx)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  board: { alignSelf: 'center', borderRadius: radius.xl, borderWidth: 1 },
});
