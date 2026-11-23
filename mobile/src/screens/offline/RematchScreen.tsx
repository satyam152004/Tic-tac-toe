import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../components/game/ActionButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { withAlpha } from '../../design-system/colors';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { seatsOf, useLocalGameStore } from '../../store/localGameStore';

import { ch, fs, ms } from '../../design-system/responsive';
const AI_LABEL = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard', EXPERT: 'Expert', IMPOSSIBLE: 'Unbeatable' } as const;

export const RematchScreen: React.FC<RootScreenProps<'rematch'>> = () => {
  const c = useTheme();
  const { nav, goHome, back } = useAppNav();
  const game = useLocalGameStore((s) => s.game);
  const setup = useLocalGameStore((s) => s.setup);
  const [swapSymbols, setSwapSymbols] = useState(false);

  const missing = !game;
  useEffect(() => {
    if (missing) goHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  if (!game) return null;
  const seats = seatsOf(setup);
  const p1Mark = setup.p1Mark;
  const p2Mark = p1Mark === 'X' ? 'O' : 'X';
  const nextP1Mark = swapSymbols ? p2Mark : p1Mark;

  const p1Name = seats[p1Mark].name;
  const p2Name = seats[p2Mark].name;
  const p1Score = game.scores[p1Mark];
  const p2Score = game.scores[p2Mark];
  const aiName = game.difficulty ? `AI ${AI_LABEL[game.difficulty]}` : 'AI';

  const startRematch = () => {
    const store = useLocalGameStore.getState();
    if (swapSymbols) {
      store.configure({ p1Mark: nextP1Mark });
      store.start();
      // New game, same series: carry the running scores over to the swapped marks.
      const fresh = useLocalGameStore.getState().game;
      if (fresh) {
        useLocalGameStore.setState({
          game: { ...fresh, scores: { ...fresh.scores, [nextP1Mark]: p1Score, [nextP1Mark === 'X' ? 'O' : 'X']: p2Score, draws: game.scores.draws } },
        });
      }
    } else {
      store.rematch();
    }
    nav.replace('offline_board');
  };

  return (
    <Screen
      title="Play Again?"
      onBack={back}
      testID="rematch"
      footer={
        <View style={{ gap: ms(8) }}>
          <ActionButton
            testID="rematch-again"
            fullWidth
            title="Start Rematch"
            onPress={startRematch}
          />
          <ActionButton
            testID="rematch-home"
            fullWidth
            variant="secondary"
            compact
            title="Go home"
            onPress={() => {
              useLocalGameStore.getState().quit();
              goHome();
            }}
          />
        </View>
      }
    >
      <View style={styles.container}>
        {/* Series Score Card */}
        <View style={[styles.seriesCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[styles.seriesOverline, { color: c.textSecondary }]}>SCORE SO FAR</Text>
          <View style={styles.scoresRow}>
            <View style={styles.scoreCol}>
              <Text style={[styles.playerName, { color: c.textSecondary }]}>
                {p1Name} ({nextP1Mark})
              </Text>
              <Text testID="series-score" style={[styles.scoreNumber, { color: c.accent }]}>
                {p1Score}
              </Text>
            </View>

            <Text style={[styles.scoreDivider, { color: '#CFCFC8' }]}>–</Text>

            <View style={styles.scoreCol}>
              <Text style={[styles.playerName, { color: c.textSecondary }]}>
                {p2Name} ({swapSymbols ? p1Mark : p2Mark})
              </Text>
              <Text style={[styles.scoreNumber, { color: c.text }]}>
                {p2Score}
              </Text>
            </View>
          </View>
        </View>

        {/* Options Group Card */}
        <View style={[styles.groupCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {/* Row 1: Swap Symbols */}
          <Pressy
            testID="rematch-swap"
            accessibilityRole="switch"
            accessibilityLabel="Swap symbols"
            accessibilityState={{ checked: swapSymbols }}
            onPress={() => setSwapSymbols((v) => !v)}
            style={styles.groupRow}
          >
            <View style={{ flex: 1, gap: ms(2) }}>
              <Text style={[styles.rowTitle, { color: c.text }]}>
                Swap Symbols (X ↔ O)
              </Text>
              <Text style={[styles.rowSub, { color: c.textSecondary }]}>
                {`${(nextP1Mark === 'X' ? p1Name : p2Name)} (X) moves first next`}
              </Text>
            </View>

            {/* Toggle switch */}
            <View
              style={[
                styles.switchTrack,
                {
                  backgroundColor: swapSymbols ? c.accent : '#E4E4DF',
                },
              ]}
            >
              <View
                style={[
                  styles.switchThumb,
                  {
                    transform: [{ translateX: swapSymbols ? ms(18) : 0 }],
                  },
                ]}
              />
            </View>
          </Pressy>

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          {/* Row 2: Keep Settings */}
          <View style={styles.groupRow}>
            <Text style={[styles.rowTitle, { color: c.textSecondary }]}>
              Keep Settings
            </Text>
            <Text style={[styles.settingsVal, { color: c.text }]}>
              {game.config.size}×{game.config.size} • {game.mode === 'VS_AI' ? aiName : 'Pass & Play'}
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: ms(14),
  },
  seriesCard: {
    borderRadius: ms(14),
    borderWidth: 1,
    padding: ms(16),
    alignItems: 'center',
    gap: ms(8),
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  seriesOverline: {
    fontSize: fs(10),
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  scoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(20),
  },
  scoreCol: {
    alignItems: 'center',
    gap: ms(2),
  },
  playerName: {
    fontSize: fs(11.5),
    fontFamily: fonts.body.semibold,
  },
  scoreNumber: {
    fontSize: fs(28),
    fontFamily: fonts.mono.semibold,
    lineHeight: Math.round(fs(28) * 1.25),
  },
  scoreDivider: {
    fontSize: fs(20),
    fontFamily: fonts.mono.semibold,
  },
  groupCard: {
    borderRadius: ms(14),
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(13),
    paddingVertical: ms(8),
    minHeight: ch(38),
  },
  rowTitle: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(12.5),
  },
  rowSub: {
    fontFamily: fonts.body.regular,
    fontSize: fs(10.5),
  },
  settingsVal: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(12),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
  },
  switchTrack: {
    width: ms(44),
    height: ms(26),
    borderRadius: 999,
    padding: ms(3),
    justifyContent: 'center',
  },
  switchThumb: {
    width: ms(20),
    height: ms(20),
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
