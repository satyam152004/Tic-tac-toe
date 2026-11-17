import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { GameBoard } from '../../components/game/GameBoard';
import { type } from '../../design-system/typography';
import { BoardSize, defaultWinLength } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';

type Cell = 'X' | 'O' | '';
/** Moves of the example game; the winning diagonal is highlighted once complete. */
const SEQUENCE: Array<[number, 'X' | 'O']> = [[0, 'X'], [1, 'O'], [4, 'X'], [5, 'O'], [8, 'X']];
const WIN_LINE = [0, 4, 8];

const SIZES: BoardSize[] = [3, 4, 5];

export const GameRulesScreen: React.FC<RootScreenProps<'game_rules'>> = () => {
  const c = useTheme();
  const { back } = useAppNav();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s >= SEQUENCE.length + 2 ? 0 : s + 1)), step === SEQUENCE.length ? 2200 : 700);
    return () => clearTimeout(t);
  }, [step]);

  const board: Cell[] = Array(9).fill('');
  SEQUENCE.slice(0, Math.min(step, SEQUENCE.length)).forEach(([i, m]) => (board[i] = m));
  const won = step >= SEQUENCE.length && step <= SEQUENCE.length + 1;

  return (
    <Screen title="Game Rules" onBack={back} testID="game-rules-screen">
      <AppCard style={{ gap: 12 }}>
        <Text style={[type.heading, { color: c.text }]}>Example Winning Board</Text>
        <GameBoard size={3} board={board} winningLine={won ? WIN_LINE : null} disabled compact maxSize={240} />
        <Text style={[type.small, { color: c.textSecondary, textAlign: 'center' }]}>Align matching symbols horizontally, vertically, or diagonally.</Text>
      </AppCard>

      <AppCard style={{ gap: 10 }}>
        <Text style={[type.subheading, { color: c.text }]}>Winning Combinations</Text>
        <View style={{ gap: 8 }}>
          {SIZES.map((s) => (
            <Text key={s} testID={`rule-${s}`} style={[type.small, { color: c.textSecondary }]}>
              {`• ${s}x${s} grid: align ${defaultWinLength(s)} in a row (horizontal, vertical or diagonal) to win.`}
            </Text>
          ))}
          <Text style={[type.small, { color: c.textSecondary }]}>{'• Turn order: X always moves first.'}</Text>
          <Text style={[type.small, { color: c.textSecondary }]}>{'• Draw rule: if every cell fills without a line, the game is a draw.'}</Text>
        </View>
      </AppCard>
    </Screen>
  );
};
