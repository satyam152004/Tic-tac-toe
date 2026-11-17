import { Pause, Play, RotateCcw, Settings } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ConfirmDialog } from '../../components/common/AppModal';
import { Screen } from '../../components/common/Screen';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { seatsOf, useLocalGameStore } from '../../store/localGameStore';
import { formatDurationMs } from '../../utils/format';

export const GamePauseScreen: React.FC<RootScreenProps<'game_pause'>> = () => {
  const c = useTheme();
  const { nav, goHome, back } = useAppNav();
  const game = useLocalGameStore((s) => s.game);
  const setup = useLocalGameStore((s) => s.setup);
  const [confirmQuit, setConfirmQuit] = useState(false);

  // Any way of leaving this screen (Android back, swipe, header) resumes the game, unless it was quit.
  useEffect(
    () =>
      nav.addListener('beforeRemove', () => {
        const s = useLocalGameStore.getState();
        if (s.game && s.paused) s.unpause();
      }),
    [nav],
  );

  useEffect(() => {
    if (!game) goHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game === null]);

  if (!game) return null;
  const seats = seatsOf(setup);
  const store = useLocalGameStore.getState;

  return (
    <Screen testID="game-pause" scroll={false} contentStyle={{ justifyContent: 'center' }}>
      <AppCard padding="lg" style={{ gap: 20, alignItems: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.accent + '33', borderWidth: 1, borderColor: c.accent + '66', alignItems: 'center', justifyContent: 'center' }}>
          <Pause size={28} color={c.accent} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text accessibilityRole="header" style={[type.title, { color: c.text }]}>Game Paused</Text>
          <Text style={[type.body, { color: c.textSecondary, marginTop: 4, textAlign: 'center' }]}>
            {seats.X.name} vs {seats.O.name} · {formatDurationMs(store().elapsedMs())}
          </Text>
        </View>
        <View style={{ gap: 10, alignSelf: 'stretch' }}>
          <AppButton
            testID="pause-resume"
            fullWidth
            title="Resume Game"
            icon={<Play size={16} color="#FFFFFF" />}
            onPress={() => {
              store().unpause();
              back();
            }}
          />
          <AppButton
            testID="pause-restart"
            fullWidth
            variant="secondary"
            title="Restart Match"
            icon={<RotateCcw size={16} color={c.text} />}
            onPress={() => {
              store().rematch();
              back();
            }}
          />
          <AppButton testID="pause-settings" fullWidth variant="secondary" title="Settings" icon={<Settings size={16} color={c.text} />} onPress={() => nav.navigate('settings')} />
          <AppButton testID="pause-quit" fullWidth variant="outline" title="Exit to Home" onPress={() => setConfirmQuit(true)} />
        </View>
      </AppCard>

      <ConfirmDialog
        open={confirmQuit}
        title="Quit Match?"
        message="Your current round progress will be discarded."
        confirmLabel="Quit"
        cancelLabel="Keep Playing"
        destructive
        onCancel={() => setConfirmQuit(false)}
        onConfirm={() => {
          setConfirmQuit(false);
          store().quit();
          goHome();
        }}
      />
    </Screen>
  );
};
