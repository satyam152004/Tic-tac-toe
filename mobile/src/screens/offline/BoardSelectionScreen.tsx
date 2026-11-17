import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Screen } from '../../components/common/Screen';
import { BoardCell, GameBoard } from '../../components/game/GameBoard';
import { type } from '../../design-system/typography';
import { BoardSize, defaultWinLength } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { useLocalGameStore } from '../../store/localGameStore';

const BOARDS: { size: BoardSize; title: string; desc: string }[] = [
  { size: 3, title: 'Classic 3x3', desc: 'Fast, pure tactical duel. Ideal for quick 60-second matches.' },
  { size: 4, title: 'Tactical 4x4', desc: 'More room to manoeuvre with extra diagonal and double-threat setups.' },
  { size: 5, title: 'Grand 5x5', desc: 'Deep strategic grid for prolonged offence and defence.' },
];

function preview(size: BoardSize): BoardCell[] {
  const cells: BoardCell[] = Array<BoardCell>(size * size).fill('');
  cells[0] = 'X';
  cells[size + 1] = 'X';
  cells[size * 2 + 2] = 'X';
  cells[1] = 'O';
  cells[size] = 'O';
  return cells;
}

export const BoardSelectionScreen: React.FC<RootScreenProps<'board_selection'>> = ({ route }) => {
  const c = useTheme();
  const { nav } = useAppNav();
  const setupMode = useLocalGameStore((s) => s.setup.mode);
  const mode = route.params?.mode ?? setupMode;
  const [size, setSize] = useState<BoardSize>(useLocalGameStore.getState().setup.size);
  const previews = useMemo(() => ({ 3: preview(3), 4: preview(4), 5: preview(5) }), []);

  const next = () => {
    const store = useLocalGameStore.getState();
    store.configure({ size, mode, winLength: undefined });
    if (mode === 'VS_AI') {
      store.start();
      nav.navigate('offline_board');
    } else {
      nav.navigate('player_setup', { mode });
    }
  };

  return (
    <Screen
      title="Board Size"
      subtitle="Choose grid & win condition"
      onBack={() => nav.goBack()}
      testID="board-selection"
      footer={<AppButton testID="board-selection-continue" fullWidth title={mode === 'VS_AI' ? `Start vs AI on ${size}x${size}` : `Use ${size}x${size} Board`} onPress={next} />}
    >
      {BOARDS.map((b) => (
        <AppCard key={b.size} testID={`board-option-${b.size}`} accessibilityLabel={`${b.title}, align ${defaultWinLength(b.size)} in a row`} selected={size === b.size} onPress={() => setSize(b.size)}>
          <View style={styles.row}>
            <View style={{ width: 96 }}>
              <GameBoard board={previews[b.size]} size={b.size} compact disabled maxSize={96} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[type.subheading, { color: c.text }]}>{b.title}</Text>
              <Text style={[type.smallStrong, { color: c.accent, marginTop: 2 }]}>Align {defaultWinLength(b.size)} in a row</Text>
              <Text style={[type.small, { color: c.textSecondary, marginTop: 4 }]}>{b.desc}</Text>
            </View>
          </View>
        </AppCard>
      ))}
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
