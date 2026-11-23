import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../components/game/ActionButton';
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

  const start = () => {
    const store = useLocalGameStore.getState();
    // Board size comes from the saved setup (3x3 by default) and can be switched on the board itself.
    store.configure({ mode: 'VS_AI', difficulty, winLength: undefined });
    store.start();
    nav.navigate('offline_board');
  };

  return (
    <Screen
      title="Bot Difficulty"
      onBack={back}
      testID="ai-difficulty"
      footer={
        <ActionButton
          testID="ai-difficulty-continue"
          fullWidth
          title="Start Game"
          onPress={start}
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
                    backgroundColor: selected ? withAlpha(c.bgElevated, 0.65) : 'transparent',
                  },
                ]}
              >
                <View style={styles.textCol}>
                  <Text
                    style={[
                      styles.tierTitle,
                      { color: selected ? c.accent : c.text },
                    ]}
                  >
                    {lvl.title}
                  </Text>
                  <Text
                    style={[
                      styles.tierNote,
                      { color: c.textSecondary },
                    ]}
                  >
                    {lvl.note}
                  </Text>
                </View>

                {/* Radio Indicator */}
                <View
                  style={[
                    styles.radioIndicator,
                    selected
                      ? { borderColor: c.accent, borderWidth: 4.5, backgroundColor: c.bgCard }
                      : { borderColor: '#CFCFC8', borderWidth: 1 },
                  ]}
                />
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
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingVertical: 8,
    minHeight: 38,
  },
  textCol: {
    flex: 1,
    gap: 0,
    paddingRight: 8,
  },
  tierTitle: {
    fontFamily: fonts.body.semibold,
    fontSize: 12,
  },
  tierNote: {
    fontFamily: fonts.body.regular,
    fontSize: 10,
  },
  radioIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
  },
});
