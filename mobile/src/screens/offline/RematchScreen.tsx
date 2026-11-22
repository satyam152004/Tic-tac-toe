import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { withAlpha } from '../../design-system/colors';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { seatsOf, useLocalGameStore } from '../../store/localGameStore';

export const RematchScreen: React.FC<RootScreenProps<'rematch'>> = () => {
  const c = useTheme();
  const { nav, goHome, back } = useAppNav();
  const game = useLocalGameStore((s) => s.game);
  const setup = useLocalGameStore((s) => s.setup);
  const [swapSymbols, setSwapSymbols] = useState(false);

  const { height: screenH } = useWindowDimensions();
  const isTall = screenH >= 780;

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

  const startRematch = () => {
    const store = useLocalGameStore.getState();
    if (swapSymbols) {
      store.configure({ p1Mark: nextP1Mark });
      store.start();
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
        <View style={{ gap: isTall ? 10 : 8 }}>
          <AppButton
            testID="rematch-again"
            fullWidth
            size={isTall ? 'lg' : 'md'}
            title="Start Rematch"
            onPress={startRematch}
          />
          <AppButton
            testID="rematch-home"
            fullWidth
            variant="secondary"
            size={isTall ? 'lg' : 'md'}
            title="Exit to Home"
            onPress={() => {
              useLocalGameStore.getState().quit();
              goHome();
            }}
          />
          <AppButton
            testID="rematch-opponent"
            fullWidth
            variant="ghost"
            size="md"
            title={game.mode === 'VS_AI' ? 'Change Difficulty' : 'Change Opponent'}
            onPress={() =>
              game.mode === 'VS_AI'
                ? nav.navigate('ai_difficulty')
                : nav.navigate('player_setup', { mode: 'LOCAL_2P' })
            }
          />
        </View>
      }
    >
      <View style={[styles.container, { gap: isTall ? 14 : 12 }]}>
        {/* Series Score Card */}
        <View style={[styles.seriesCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[styles.seriesOverline, { color: c.textSecondary }]}>CURRENT SERIES</Text>
          <View style={styles.scoresRow}>
            <View style={styles.scoreCol}>
              <Text style={[styles.playerName, { color: c.textSecondary }]}>
                {seats[p1Mark].name} ({p1Mark})
              </Text>
              <Text testID="series-score" style={[styles.scoreNumber, { color: c.accent }]}>
                {game.scores[p1Mark]}
              </Text>
            </View>

            <Text style={[styles.scoreDivider, { color: '#CFCFC8' }]}>–</Text>

            <View style={styles.scoreCol}>
              <Text style={[styles.playerName, { color: c.textSecondary }]}>
                {seats[p2Mark].name} ({p2Mark})
              </Text>
              <Text style={[styles.scoreNumber, { color: c.text }]}>
                {game.scores[p2Mark]}
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
            style={[styles.groupRow, { paddingVertical: isTall ? 14 : 11 }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.rowTitle, { color: c.text, fontSize: isTall ? 13.5 : 12.5 }]}>
                Swap Symbols (X ↔ O)
              </Text>
              <Text style={[styles.rowSub, { color: c.textSecondary, fontSize: isTall ? 11 : 10.5 }]}>
                {swapSymbols
                  ? `${seats[p2Mark].name} (X) moves first next`
                  : `${seats[p1Mark].name} (X) moves first next`}
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
                    transform: [{ translateX: swapSymbols ? 16 : 0 }],
                  },
                ]}
              />
            </View>
          </Pressy>

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          {/* Row 2: Keep Settings */}
          <View style={[styles.groupRow, { paddingVertical: isTall ? 14 : 11 }]}>
            <Text style={[styles.rowTitle, { color: c.textSecondary, fontSize: isTall ? 13 : 12 }]}>
              Keep Settings
            </Text>
            <Text style={[styles.settingsVal, { color: c.text, fontSize: isTall ? 13 : 12 }]}>
              {game.config.size}×{game.config.size} • {game.mode === 'VS_AI' ? `AI ${game.difficulty ?? 'MEDIUM'}` : 'Pass & Play'}
            </Text>
          </View>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  seriesCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  seriesOverline: {
    fontSize: 10,
    fontFamily: fonts.body.semibold,
    letterSpacing: 0.8,
  },
  scoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  scoreCol: {
    alignItems: 'center',
    gap: 2,
  },
  playerName: {
    fontSize: 12,
    fontFamily: fonts.body.medium,
  },
  scoreNumber: {
    fontSize: 28,
    fontFamily: fonts.mono.semibold,
    lineHeight: 34,
  },
  scoreDivider: {
    fontSize: 20,
    fontFamily: fonts.mono.semibold,
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  rowTitle: {
    fontFamily: fonts.body.semibold,
  },
  rowSub: {
    fontFamily: fonts.body.regular,
  },
  settingsVal: {
    fontFamily: fonts.body.semibold,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  switchTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
