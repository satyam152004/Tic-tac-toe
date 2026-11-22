import React, { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { withAlpha } from '../../design-system/colors';
import { Difficulty } from '../../game-engine';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { useLocalGameStore } from '../../store/localGameStore';

export const AI_LEVELS: { id: Difficulty; title: string; note: string }[] = [
  { id: 'EASY', title: 'Easy — Casual warmups', note: 'Plays relaxed legal openings' },
  { id: 'MEDIUM', title: 'Medium — Blocks threats', note: 'Takes wins, blocks & prefers center' },
  { id: 'HARD', title: 'Hard — 2-step lookahead', note: 'Evaluates tactical forks & traps' },
  { id: 'EXPERT', title: 'Expert — Deep search', note: '6-ply depth search under 250ms' },
  { id: 'IMPOSSIBLE', title: 'Unbeatable — Minimax', note: 'Zero-mistake full tree evaluation' },
];

export const AiDifficultyScreen: React.FC<RootScreenProps<'ai_difficulty'>> = () => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const initial = useLocalGameStore.getState().setup;
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty);

  const { height: screenH } = useWindowDimensions();
  const isTall = screenH >= 780;

  const next = () => {
    useLocalGameStore.getState().configure({ mode: 'VS_AI', difficulty });
    nav.navigate('board_selection', { mode: 'VS_AI' });
  };

  return (
    <Screen
      title="Bot Difficulty"
      onBack={back}
      testID="ai-difficulty"
      footer={
        <AppButton
          testID="ai-difficulty-continue"
          fullWidth
          size={isTall ? 'lg' : 'md'}
          title="Choose Board"
          onPress={next}
        />
      }
    >
      <View style={[styles.groupCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        {AI_LEVELS.map((lvl, index) => {
          const selected = difficulty === lvl.id;
          const isLast = index === AI_LEVELS.length - 1;

          return (
            <React.Fragment key={lvl.id}>
              <Pressy
                testID={`difficulty-${lvl.id}`}
                accessibilityLabel={`${lvl.title}. ${lvl.note}${selected ? ', selected' : ''}`}
                onPress={() => setDifficulty(lvl.id)}
                style={[
                  styles.tierRow,
                  {
                    paddingVertical: isTall ? 14 : 11,
                    backgroundColor: selected ? c.bgElevated : 'transparent',
                  },
                ]}
              >
                <View style={styles.textCol}>
                  <Text
                    style={[
                      styles.tierTitle,
                      { color: selected ? c.accent : c.text, fontSize: isTall ? 13.5 : 12.5 },
                    ]}
                  >
                    {lvl.title}
                  </Text>
                  <Text
                    style={[
                      styles.tierNote,
                      { color: c.textSecondary, fontSize: isTall ? 11 : 10 },
                    ]}
                  >
                    {lvl.note}
                  </Text>
                </View>

                {/* Radio Indicator */}
                <View
                  style={[
                    styles.radioIndicator,
                    {
                      width: isTall ? 20 : 18,
                      height: isTall ? 20 : 18,
                      borderRadius: isTall ? 10 : 9,
                      borderColor: selected ? c.accent : '#CFCFC8',
                      borderWidth: 1.5,
                      backgroundColor: '#FFFFFF',
                    },
                  ]}
                >
                  {selected ? (
                    <View
                      style={{
                        width: isTall ? 10 : 9,
                        height: isTall ? 10 : 9,
                        borderRadius: isTall ? 5 : 4.5,
                        backgroundColor: c.accent,
                      }}
                    />
                  ) : null}
                </View>
              </Pressy>

              {!isLast ? (
                <View style={[styles.divider, { backgroundColor: c.border }]} />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  textCol: {
    flex: 1,
    gap: 2,
    paddingRight: 10,
  },
  tierTitle: {
    fontFamily: fonts.body.semibold,
  },
  tierNote: {
    fontFamily: fonts.body.regular,
  },
  radioIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
});
