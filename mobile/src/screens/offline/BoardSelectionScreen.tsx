import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { ActionButton } from '../../components/game/ActionButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { withAlpha } from '../../design-system/colors';
import { BoardSize, defaultWinLength } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { useLocalGameStore } from '../../store/localGameStore';

import { ch, fs, ms } from '../../design-system/responsive';
interface BoardOption {
  size: BoardSize;
  title: string;
  desc: string;
}

const BOARDS: BoardOption[] = [
  { size: 3, title: '3×3 Classic', desc: 'Get 3 in a row • Quick rounds' },
  { size: 4, title: '4×4 Bigger', desc: 'Get 4 in a row • More room to plan' },
  { size: 5, title: '5×5 Biggest', desc: 'Get 4 in a row • Longer games' },
];

export const BoardSelectionScreen: React.FC<RootScreenProps<'board_selection'>> = ({ route }) => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const setupMode = useLocalGameStore((s) => s.setup.mode);
  const mode = route.params?.mode ?? setupMode;
  const [size, setSize] = useState<BoardSize>(useLocalGameStore.getState().setup.size);

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
      onBack={back}
      testID="board-selection"
      footer={
        <ActionButton
          testID="board-selection-continue"
          fullWidth
          title="Next"
          onPress={next}
        />
      }
    >
      <View style={styles.container}>
        {BOARDS.map((b) => {
          const selected = size === b.size;

          return (
            <Pressy
              key={b.size}
              testID={`board-option-${b.size}`}
              accessibilityLabel={`${b.title}, align ${defaultWinLength(b.size)} in a row${selected ? ', selected' : ''}`}
              onPress={() => setSize(b.size)}
              style={[
                styles.boardCard,
                {
                  padding: ms(12),
                  borderRadius: ms(14),
                  backgroundColor: selected ? withAlpha(c.bgElevated, 0.55) : c.bgCard,
                  borderColor: selected ? c.accent : c.border,
                  borderWidth: selected ? 1.5 : 1,
                },
              ]}
            >
              <View style={styles.cardLeft}>
                {/* Mini Visual Grid Preview: 44px box, 6px padding, 2px gaps */}
                <View style={[styles.gridPreviewBox, { borderColor: c.border, backgroundColor: c.bgCard }]}>
                  {Array.from({ length: b.size }).map((_, r) => (
                    <View key={r} style={styles.previewRow}>
                      {Array.from({ length: b.size }).map((__, col) => (
                        <View
                          key={col}
                          style={[styles.previewCell, { backgroundColor: selected ? withAlpha(c.accent, 0.25) : c.border }]}
                        />
                      ))}
                    </View>
                  ))}
                </View>

                {/* Text Info */}
                <View style={styles.textCol}>
                  <Text style={[styles.boardTitle, { color: c.text }]}>
                    {b.title}
                  </Text>
                  <Text
                    style={[styles.boardDesc, { color: c.textSecondary }]}
                  >
                    {b.desc}
                  </Text>
                </View>
              </View>

              {/* Selection Check Circle */}
              <View
                style={[
                  styles.checkCircle,
                  selected
                    ? { backgroundColor: c.accent }
                    : { borderColor: '#CFCFC8', borderWidth: 1 },
                ]}
              >
                {selected ? <Check size={ms(15)} color="#FFFFFF" strokeWidth={2.6} /> : null}
              </View>
            </Pressy>
          );
        })}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 0,
    gap: ms(12),
  },
  boardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    flex: 1,
  },
  gridPreviewBox: {
    width: ms(44),
    height: ch(44),
    borderRadius: ms(10),
    borderWidth: 1,
    padding: ms(6),
    gap: ms(2),
  },
  previewRow: { flex: 1, flexDirection: 'row', gap: ms(2) },
  previewCell: { flex: 1, borderRadius: ms(2) },
  textCol: {
    flex: 1,
    gap: ms(2),
  },
  boardTitle: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(13),
  },
  boardDesc: {
    fontFamily: fonts.body.regular,
    fontSize: fs(11),
  },
  checkCircle: {
    width: ms(24),
    height: ms(24),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: ms(8),
  },
});
