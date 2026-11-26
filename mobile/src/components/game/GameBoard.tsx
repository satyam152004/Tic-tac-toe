import type { ThemeColors } from '../../design-system/colors';
import React, { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { withAlpha } from '../../design-system/colors';
import { radius } from '../../design-system/radius';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from '../common/Pressy';
import { BoardSize, boardMetrics } from './boardLayout';
import { SymbolMark } from './SymbolMark';

export type BoardCell = 'X' | 'O' | '' | null;


interface CellProps {
  index: number;
  value: BoardCell;
  side: number;
  glyph: number;
  winning: boolean;
  last: boolean;
  hint: boolean;
  disabled: boolean;
  compact: boolean;
  corner: number;
  onPress: (i: number) => void;
}

const Cell = memo(function Cell({ index, value, side, glyph, winning, last, hint, disabled, compact, corner, onPress }: CellProps) {
  const c = useTheme();
  const styles = makeStyles(c);
  const filled = value === 'X' || value === 'O';
  const winBg = compact ? (c.bgElevated === withAlpha(c.accent, 0.12) ? withAlpha(c.accent, 0.12) : withAlpha(c.accent, 0.18)) : withAlpha(c.accent, 0.2);
  const winBorder = compact ? (c.bgElevated === withAlpha(c.accent, 0.12) ? withAlpha(c.accent, 0.35) : withAlpha(c.accent, 0.35)) : c.accent;
  const cellRadius = compact ? (side < 35 ? 6 : side < 45 ? 8 : 10) : corner;

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
        borderRadius: cellRadius,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: winning ? winBg : hint ? withAlpha(c.accent, 0.12) : last ? c.bgElevated : c.bgSecondary,
        borderColor: winning ? winBorder : hint ? c.accent : last ? withAlpha(c.accent, 0.6) : c.border,
        ...(winning && !compact
          ? { shadowColor: c.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 4 }
          : null),
      }}
    >
      {filled ? <SymbolMark value={value as 'X' | 'O'} size={glyph} glow={!compact} animate={!compact} /> : null}
    </Pressy>
  );
});

export interface GameBoardProps {
  board: BoardCell[];
  size: BoardSize;
  winningLine?: number[] | null;
  lastMoveIndex?: number | null;
  /** Cell suggested by a hint (free hints in Computer and Pass n play). */
  hintIndex?: number | null;
  disabled?: boolean;
  /** Small static preview: tighter gaps and no glow. */
  compact?: boolean;
  /** Largest outer side (dp) when `side` is not given. */
  maxSize?: number;
  /** Exact outer side (dp), measured from the space the screen leaves for the board (see BoardArea). */
  side?: number;
  onCellPress?: (index: number) => void;
}

/**
 * Square board for 3x3, 4x4 and 5x5. Its side is `side` when the screen measured the available space, otherwise the
 * smaller of the window width (minus gutters) and `maxSize` (used by the static previews).
 */
export const GameBoard: React.FC<GameBoardProps> = ({ board, size, winningLine = null, lastMoveIndex = null, hintIndex = null, disabled = false, compact = false, maxSize = 340, side, onCellPress }) => {
  const c = useTheme();
  const styles = makeStyles(c);
  const { width } = useWindowDimensions();
  const outer = side ?? Math.min(width - 40, maxSize);
  const { gap, pad, cell, glyph, corner } = boardMetrics(size, outer, compact);
  const winSet = useMemo(() => new Set(winningLine ?? []), [winningLine]);

  return (
    <View
      accessibilityLabel={`${size} by ${size} game board`}
      style={[
        styles.board,
        {
          width: outer,
          backgroundColor: c.bgCard,
          borderColor: c.border,
          padding: pad,
          gap,
          borderRadius: compact ? radius.lg : radius.xl,
          ...(compact ? styles.compactShadow : null),
        },
      ]}
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
                hint={hintIndex === i}
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

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  board: { alignSelf: 'center', borderWidth: 1 },
  compactShadow: {
    shadowColor: c.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
});
