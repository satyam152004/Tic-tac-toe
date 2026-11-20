import { Grid3X3, Repeat, RotateCcw, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { seatsOf, useLocalGameStore } from '../../store/localGameStore';

export const RematchScreen: React.FC<RootScreenProps<'rematch'>> = () => {
  const c = useTheme();
  const { nav, goHome } = useAppNav();
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
    <Screen title="Play Again?" subtitle="Series & rematch options" onBack={() => nav.goBack()} testID="rematch">
      <AppCard style={{ alignItems: 'center', gap: 8 }}>
        <Text style={[type.caption, { color: c.textSecondary }]}>CURRENT SERIES</Text>
        <Text testID="series-score" style={[type.title, { color: c.text, fontFamily: type.num.fontFamily }]}>
          {game.scores[p1Mark]} — {game.scores[p2Mark]}
        </Text>
        <Text style={[type.small, { color: c.textSecondary }]}>
          {seats[p1Mark].name} vs {seats[p2Mark].name} · {game.scores.draws} draws
        </Text>
      </AppCard>

      <AppCard style={{ gap: 12 }}>
        <Pressy
          testID="rematch-swap"
          accessibilityRole="switch"
          accessibilityLabel="Swap symbols"
          accessibilityState={{ checked: swapSymbols }}
          onPress={() => setSwapSymbols((v) => !v)}
          style={styles.row}
        >
          <Repeat size={18} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: c.text }]}>Swap Symbols (X ↔ O)</Text>
            <Text style={[type.caption, { color: c.textSecondary }]}>
              Next round: {setup.p1Name} plays as {nextP1Mark}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: swapSymbols ? c.accent : c.bgSecondary, borderColor: c.border, borderWidth: swapSymbols ? 0 : 1 }]}>
            <View style={[styles.thumb, { transform: [{ translateX: swapSymbols ? 20 : 0 }] }]} />
          </View>
        </Pressy>
        <View style={[styles.metaRow, { borderTopColor: c.border }]}>
          <Text style={[type.small, { color: c.textSecondary }]}>Keep Settings</Text>
          <Text style={[type.smallStrong, { color: c.text }]}>
            {game.config.size}×{game.config.size} · {game.mode === 'VS_AI' ? `AI ${game.difficulty ?? 'MEDIUM'}` : 'Pass & Play'}
          </Text>
        </View>
      </AppCard>

      <View style={{ gap: 10 }}>
        <AppButton
          testID="rematch-again"
          fullWidth
          title="Play Again Immediately"
          icon={<RotateCcw size={16} color="#FFFFFF" />}
          onPress={startRematch}
        />
        <AppButton
          testID="rematch-opponent"
          fullWidth
          variant="secondary"
          title={game.mode === 'VS_AI' ? 'Change Difficulty' : 'Change Opponent'}
          icon={<Users size={16} color={c.text} />}
          onPress={() => (game.mode === 'VS_AI' ? nav.navigate('ai_difficulty') : nav.navigate('player_setup', { mode: 'LOCAL_2P' }))}
        />
        <AppButton
          testID="rematch-board"
          fullWidth
          variant="secondary"
          title="Change Board Size"
          icon={<Grid3X3 size={16} color={c.text} />}
          onPress={() => nav.navigate('board_selection', { mode: game.mode })}
        />
        <AppButton
          testID="rematch-home"
          fullWidth
          variant="outline"
          title="Return Home"
          onPress={() => {
            useLocalGameStore.getState().quit();
            goHome();
          }}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  track: { width: 48, height: 28, borderRadius: 14, padding: 4, justifyContent: 'center' },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
