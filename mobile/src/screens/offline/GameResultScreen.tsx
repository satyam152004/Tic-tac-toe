import React, { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Flame, RotateCcw, Settings, Sparkles, Trophy } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { Screen } from '../../components/common/Screen';
import { GameBoard } from '../../components/game/GameBoard';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { seatsOf, useLocalGameStore } from '../../store/localGameStore';
import { useAuthStore } from '../../store/authStore';
import { formatDurationMs } from '../../utils/format';

export const GameResultScreen: React.FC<RootScreenProps<'game_result'>> = () => {
  const c = useTheme();
  const { nav, goHome } = useAppNav();
  const game = useLocalGameStore((s) => s.game);
  const setup = useLocalGameStore((s) => s.setup);
  const lastMatchId = useLocalGameStore((s) => s.lastMatchId);
  const streak = useAuthStore((s) => s.user?.stats.currentStreak ?? 1);
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);

  const { height: screenH } = useWindowDimensions();
  const isTall = screenH >= 780;

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
  const title = isDraw ? 'Match Draw' : vsAi ? (humanWon ? 'You Won!' : 'You Lost') : `${seats[winner!].name} Wins!`;

  const badgeText = isDraw ? 'Draw' : vsAi ? (humanWon ? 'Victory' : 'Defeat') : 'Victory';
  const badgeBg = isDraw ? '#F1F1EE' : humanLost ? '#FEF2F2' : '#F0FDF4';
  const badgeBorder = isDraw ? '#E4E4DF' : humanLost ? '#FECACA' : '#BBF7D0';
  const badgeColor = isDraw ? '#5C606A' : humanLost ? '#DC2626' : '#15803D';

  const changeSettings = () => {
    if (vsAi) nav.navigate('ai_difficulty');
    else nav.navigate('player_setup', { mode: 'LOCAL_2P' });
  };

  return (
    <Screen
      testID="game-result"
      contentStyle={[styles.container, { gap: isTall ? 14 : 10 }]}
      footer={
        <View style={{ gap: isTall ? 10 : 8 }}>
          <AppButton
            testID="result-rematch"
            fullWidth
            size={isTall ? 'lg' : 'md'}
            title="Rematch"
            icon={<RotateCcw size={16} color="#FFFFFF" />}
            onPress={() => {
              useLocalGameStore.getState().rematch();
              nav.replace('offline_board');
            }}
          />
          <View style={styles.btnRow}>
            <AppButton
              testID="result-settings"
              style={styles.flexBtn}
              variant="secondary"
              size={isTall ? 'lg' : 'md'}
              title="Change Mode"
              onPress={changeSettings}
            />
            <AppButton
              testID="result-home"
              style={styles.flexBtn}
              variant="secondary"
              size={isTall ? 'lg' : 'md'}
              title="Home"
              onPress={() => {
                useLocalGameStore.getState().quit();
                goHome();
              }}
            />
          </View>
          <AppButton
            testID="result-options"
            fullWidth
            variant="ghost"
            size="md"
            title="Series Details"
            onPress={() => nav.navigate('rematch')}
          />
        </View>
      }
    >
      {/* Top Banner / Celebration */}
      <View style={styles.heroBlock}>
        <View style={[styles.statusBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
          <Text style={[styles.statusBadgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>

        <Text testID="result-title" accessibilityRole="header" style={[styles.titleText, { color: c.text, fontSize: isTall ? 24 : 20 }]}>
          {title}
        </Text>
      </View>

      {/* Final Board Area */}
      <View style={styles.boardWrap}>
        <GameBoard
          board={game.board}
          size={game.config.size}
          winningLine={out.status === 'WIN' ? out.line : null}
          compact
          disabled
          maxSize={isTall ? 220 : 180}
        />
      </View>

      {/* 3-Column Stats Card */}
      <View style={[styles.statsCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        <View style={styles.statCol}>
          <Text style={[styles.statVal, { color: c.text }]}>{game.moves.length}</Text>
          <Text style={[styles.statSub, { color: c.textSecondary }]}>Moves</Text>
        </View>

        <View style={[styles.statCol, styles.statBorder, { borderColor: c.border }]}>
          <Text style={[styles.statVal, { color: c.text }]}>{formatDurationMs(game.elapsedMs)}</Text>
          <Text style={[styles.statSub, { color: c.textSecondary }]}>Duration</Text>
        </View>

        <View style={styles.statCol}>
          <Text style={[styles.statVal, { color: c.accent }]}>+25 XP</Text>
          <Text style={[styles.statSub, { color: c.textSecondary }]}>Earned</Text>
        </View>
      </View>

      {/* Streak / Bonus Pill */}
      {humanWon ? (
        <View style={[styles.streakPill, { backgroundColor: '#EFF4FF', borderColor: '#BFDBFE' }]}>
          <Flame size={14} color="#1D4ED8" fill="#1D4ED8" />
          <Text style={[styles.streakPillText, { color: '#1D4ED8' }]}>
            {streak}-Win Streak Bonus (+10 Coins)
          </Text>
        </View>
      ) : null}

      {lastMatchId ? (
        <Text testID="result-saved" style={[styles.savedText, { color: c.textSecondary }]}>
          Saved to match history
        </Text>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    alignItems: 'center',
  },
  heroBlock: {
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: fonts.body.semibold,
  },
  titleText: {
    fontFamily: fonts.body.semibold,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  boardWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  statVal: {
    fontSize: 14,
    fontFamily: fonts.mono.semibold,
  },
  statSub: {
    fontSize: 10,
    fontFamily: fonts.body.regular,
  },
  streakPill: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
  },
  streakPillText: {
    fontSize: 11.5,
    fontFamily: fonts.body.semibold,
  },
  savedText: {
    fontSize: 10.5,
    fontFamily: fonts.body.regular,
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexBtn: {
    flex: 1,
  },
});
