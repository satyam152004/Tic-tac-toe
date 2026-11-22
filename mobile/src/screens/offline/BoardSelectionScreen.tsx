import React, { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { withAlpha } from '../../design-system/colors';
import { BoardSize, defaultWinLength } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { useLocalGameStore } from '../../store/localGameStore';

interface BoardOption {
  size: BoardSize;
  title: string;
  desc: string;
}

const BOARDS: BoardOption[] = [
  { size: 3, title: '3×3 Classic', desc: '3-in-a-row • Quick 1 min rounds' },
  { size: 4, title: '4×4 Extended', desc: '4-in-a-row • Deeper positioning' },
  { size: 5, title: '5×5 Tactical', desc: '4-in-a-row • Long strategic duels' },
];

export const BoardSelectionScreen: React.FC<RootScreenProps<'board_selection'>> = ({ route }) => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const setupMode = useLocalGameStore((s) => s.setup.mode);
  const mode = route.params?.mode ?? setupMode;
  const [size, setSize] = useState<BoardSize>(useLocalGameStore.getState().setup.size);

  const { height: screenH } = useWindowDimensions();
  const isTall = screenH >= 780;

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
        <AppButton
          testID="board-selection-continue"
          fullWidth
          size={isTall ? 'lg' : 'md'}
          title={mode === 'VS_AI' ? 'Start Match' : 'Next'}
          onPress={next}
        />
      }
    >
      <View style={[styles.container, { gap: isTall ? 14 : 11 }]}>
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
                  padding: isTall ? 16 : 14,
                  borderRadius: isTall ? 16 : 14,
                  backgroundColor: selected ? c.bgElevated : c.bgCard,
                  borderColor: selected ? c.accent : c.border,
                  borderWidth: selected ? 1.5 : 1,
                },
              ]}
            >
              <View style={styles.cardLeft}>
                {/* Mini Visual Grid Preview */}
                <View
                  style={[
                    styles.gridPreviewBox,
                    {
                      width: isTall ? 46 : 42,
                      height: isTall ? 46 : 42,
                      borderRadius: isTall ? 10 : 8,
                      borderColor: c.border,
                      backgroundColor: c.bgPrimary,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.miniGrid,
                      {
                        width: '100%',
                        height: '100%',
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 2,
                        padding: 3,
                      },
                    ]}
                  >
                    {Array.from({ length: b.size * b.size }).map((_, i) => (
                      <View
                        key={i}
                        style={{
                          width: `${100 / b.size - 4}%`,
                          aspectRatio: 1,
                          borderRadius: 2,
                          backgroundColor: selected ? withAlpha(c.accent, 0.35) : '#E4E4DF',
                        }}
                      />
                    ))}
                  </View>
                </View>

                {/* Text Info */}
                <View style={styles.textCol}>
                  <Text style={[styles.boardTitle, { color: c.text, fontSize: isTall ? 14.5 : 13.5 }]}>
                    {b.title}
                  </Text>
                  <Text
                    style={[styles.boardDesc, { color: c.textSecondary, fontSize: isTall ? 11.5 : 10.5 }]}
                  >
                    {b.desc}
                  </Text>
                </View>
              </View>

              {/* Selection Check Circle */}
              <View
                style={[
                  styles.checkCircle,
                  {
                    width: isTall ? 22 : 20,
                    height: isTall ? 22 : 20,
                    borderRadius: isTall ? 11 : 10,
                    backgroundColor: selected ? c.accent : 'transparent',
                    borderColor: selected ? c.accent : '#CFCFC8',
                    borderWidth: selected ? 0 : 1.2,
                  },
                ]}
              >
                {selected ? <Check size={isTall ? 13 : 11} color="#FFFFFF" strokeWidth={2.6} /> : null}
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
    paddingTop: 4,
  },
  boardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  gridPreviewBox: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniGrid: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  boardTitle: {
    fontFamily: fonts.body.semibold,
  },
  boardDesc: {
    fontFamily: fonts.body.regular,
  },
  checkCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
