import { Grid3X3, RotateCcw, Users } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
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

  const missing = !game;
  useEffect(() => {
    if (missing) goHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  if (!game) return null;
  const seats = seatsOf(setup);
  const p1Mark = setup.p1Mark;
  const p2Mark = p1Mark === 'X' ? 'O' : 'X';

  return (
    <Screen title="Rematch" subtitle="Choose your next round" onBack={() => nav.goBack()} testID="rematch">
      <AppCard style={{ alignItems: 'center', gap: 8 }}>
        <Text style={[type.small, { color: c.textSecondary }]}>Current Series Score</Text>
        <Text testID="series-score" style={[type.title, { color: c.text, fontFamily: type.num.fontFamily }]}>
          {game.scores[p1Mark]} — {game.scores[p2Mark]}
        </Text>
        <Text style={[type.small, { color: c.textSecondary }]}>
          {seats[p1Mark].name} vs {seats[p2Mark].name} · {game.scores.draws} draws
        </Text>
      </AppCard>

      <View style={{ gap: 10 }}>
        <AppButton
          testID="rematch-again"
          fullWidth
          title="Play Again Immediately"
          icon={<RotateCcw size={16} color="#FFFFFF" />}
          onPress={() => {
            useLocalGameStore.getState().rematch();
            nav.replace('offline_board');
          }}
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
