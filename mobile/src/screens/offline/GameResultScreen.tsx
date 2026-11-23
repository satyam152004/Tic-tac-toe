import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../components/game/ActionButton';
import { Screen } from '../../components/common/Screen';
import { GameBoard } from '../../components/game/GameBoard';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { seatsOf, useLocalGameStore } from '../../store/localGameStore';
import { formatDurationMs } from '../../utils/format';

import { fs, ms } from '../../design-system/responsive';
export const GameResultScreen: React.FC<RootScreenProps<'game_result'>> = () => {
  const c = useTheme();
  const { nav, goHome, goTab } = useAppNav();
  const game = useLocalGameStore((s) => s.game);
  const setup = useLocalGameStore((s) => s.setup);
  const lastMatchId = useLocalGameStore((s) => s.lastMatchId);

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
  const title = isDraw ? "It's a draw" : vsAi ? (humanWon ? 'You Won!' : 'You Lost') : `${seats[winner!].name} Wins!`;

  const badgeText = isDraw ? 'Draw' : vsAi ? (humanWon ? 'Win' : 'Loss') : 'Win';
  const badgeBg = isDraw ? '#F1F1EE' : humanLost ? '#FEF2F2' : '#F0FDF4';
  const badgeBorder = isDraw ? '#E4E4DF' : humanLost ? '#FECACA' : '#BBF7D0';
  const badgeColor = isDraw ? '#5C606A' : humanLost ? '#DC2626' : '#15803D';

  const changeMode = () => goTab('PlayTab');

  return (
    <Screen
      testID="game-result"
      contentStyle={styles.container}
      gap={14}
      footer={
        <View style={{ gap: ms(8) }}>
          <ActionButton
            testID="result-rematch"
            fullWidth
            title="Rematch"
            onPress={() => nav.navigate('rematch')}
          />
          <View style={styles.btnRow}>
            <ActionButton
              testID="result-settings"
              style={styles.flexBtn}
              variant="secondary"
              compact
              title="Change Mode"
              onPress={changeMode}
            />
            <ActionButton
              testID="result-home"
              style={styles.flexBtn}
              variant="secondary"
              compact
              title="Home"
              onPress={() => {
                useLocalGameStore.getState().quit();
                goHome();
              }}
            />
          </View>
        </View>
      }
    >
      {/* Top Banner / Celebration */}
      <View style={styles.heroBlock}>
        <View style={[styles.statusBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
          <Text style={[styles.statusBadgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>

        <Text testID="result-title" accessibilityRole="header" style={[styles.titleText, { color: c.text }]}>
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
          maxSize={156}
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
          <Text style={[styles.statVal, { color: c.accent }]}>{game.config.size}×{game.config.size}</Text>
          <Text style={[styles.statSub, { color: c.textSecondary }]}>Board</Text>
        </View>
      </View>

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
    paddingTop: ms(12),
    alignItems: 'center',
  },
  heroBlock: {
    alignItems: 'center',
    gap: ms(4),
  },
  statusBadge: {
    paddingHorizontal: ms(10),
    paddingVertical: ms(2),
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: fs(11),
    fontFamily: fonts.body.semibold,
  },
  titleText: {
    fontFamily: fonts.body.semibold,
    fontSize: fs(21),
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  boardWrap: {
    width: '100%',
    marginTop: -2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    width: '100%',
    borderRadius: ms(14),
    borderWidth: 1,
    paddingVertical: ms(10),
    paddingHorizontal: ms(8),
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
    gap: ms(2),
  },
  statBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  statVal: {
    fontSize: fs(14),
    fontFamily: fonts.mono.semibold,
  },
  statSub: {
    fontSize: fs(10),
    fontFamily: fonts.body.regular,
  },
  savedText: {
    fontSize: fs(10.5),
    fontFamily: fonts.body.regular,
    marginTop: ms(2),
  },
  btnRow: {
    flexDirection: 'row',
    gap: ms(10),
  },
  flexBtn: {
    flex: 1,
  },
});
