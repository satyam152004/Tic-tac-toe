import { Settings, ShieldAlert, Sparkles, Trophy } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { AppAvatar } from '../../components/common/AppAvatar';
import { AppButton } from '../../components/common/AppButton';
import { Screen } from '../../components/common/Screen';
import { GameBoard } from '../../components/game/GameBoard';
import { SymbolMark } from '../../components/game/SymbolMark';
import { ScoreCard } from '../../components/profile/Cards';
import { iconSize } from '../../design-system/icons';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { seatsOf, useLocalGameStore } from '../../store/localGameStore';
import { formatDurationMs } from '../../utils/format';

export const GameResultScreen: React.FC<RootScreenProps<'game_result'>> = () => {
  const c = useTheme();
  const { nav, goHome } = useAppNav();
  const game = useLocalGameStore((s) => s.game);
  const setup = useLocalGameStore((s) => s.setup);
  const lastMatchId = useLocalGameStore((s) => s.lastMatchId);
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!reduced) pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, [reduced, pulse]);
  const trophyStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const missing = !game;
  useEffect(() => {
    if (missing) goHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  if (!game) return null;
  const seats = seatsOf(setup);
  const out = game.outcome;
  const isDraw = out.status !== 'WIN';
  const winner = out.status === 'WIN' ? out.winner : null;
  const vsAi = game.mode === 'VS_AI';
  const humanWon = vsAi && winner === game.humanMark;
  const humanLost = vsAi && winner !== null && winner !== game.humanMark;
  const title = isDraw ? 'Match Draw' : vsAi ? (humanWon ? 'You Win!' : 'You Lost') : `${seats[winner!].name} Wins!`;
  const tone = humanLost ? c.danger : c.warning;
  const showCelebration = !isDraw && !humanLost;

  const changeSettings = () => {
    if (vsAi) nav.navigate('ai_difficulty');
    else nav.navigate('player_setup', { mode: 'LOCAL_2P' });
  };

  return (
    <Screen
      testID="game-result"
      contentStyle={{ paddingTop: 24 }}
      footer={
        <>
          <AppButton
            testID="result-rematch"
            fullWidth
            title="Rematch"
            icon={<Sparkles size={16} color="#FFFFFF" />}
            onPress={() => {
              useLocalGameStore.getState().rematch();
              nav.replace('offline_board');
            }}
          />
          {/* Stacked, full width: side by side these two labels clip below ~400dp and at large font scales. */}
          <AppButton testID="result-settings" fullWidth variant="secondary" size="md" title="Change Setup" icon={<Settings size={iconSize.sm} color={c.text} />} onPress={changeSettings} />
          <AppButton testID="result-options" fullWidth variant="secondary" size="md" title="Series" onPress={() => nav.navigate('rematch')} />
          <AppButton
            testID="result-home"
            fullWidth
            variant="outline"
            title="Back to Home"
            onPress={() => {
              useLocalGameStore.getState().quit();
              goHome();
            }}
          />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 14 }}>
        <Animated.View style={[styles.badge, { borderColor: tone + '80', backgroundColor: tone + '33' }, showCelebration ? trophyStyle : null]}>
          {isDraw || humanLost ? <ShieldAlert size={32} color={tone} /> : <Trophy size={32} color={tone} />}
        </Animated.View>
        <Text testID="result-title" accessibilityRole="header" style={[type.title, { color: c.text, textAlign: 'center' }]}>{title}</Text>
        <Text style={[type.small, { color: c.textSecondary, fontFamily: type.num.fontFamily }]}>
          {game.config.size}x{game.config.size} Board · {game.moves.length} moves · {formatDurationMs(game.elapsedMs)}
        </Text>
        {winner ? (
          <View style={styles.row}>
            <AppAvatar avatarId={seats[winner].avatar} name={seats[winner].name} size="lg" activeRing />
            <SymbolMark value={winner} size="lg" />
          </View>
        ) : null}
      </View>

      <GameBoard board={game.board} size={game.config.size} winningLine={out.status === 'WIN' ? out.line : null} compact disabled maxSize={260} />

      <View style={styles.row}>
        <View style={{ flex: 1 }}><ScoreCard label={`${seats.X.name} (X)`} value={game.scores.X} tone="accent" /></View>
        <View style={{ flex: 1 }}><ScoreCard label="Draws" value={game.scores.draws} /></View>
        <View style={{ flex: 1 }}><ScoreCard label={`${seats.O.name} (O)`} value={game.scores.O} tone="success" /></View>
      </View>

      {lastMatchId ? (
        <Text testID="result-saved" style={[type.caption, { color: c.textSecondary, textAlign: 'center' }]}>Saved to match history</Text>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  badge: { width: 64, height: 64, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
