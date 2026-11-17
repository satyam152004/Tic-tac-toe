import { Pause, RotateCcw, Undo2, Volume2, VolumeX } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppIconButton } from '../../components/common/AppIconButton';
import { Screen } from '../../components/common/Screen';
import { GameBoard } from '../../components/game/GameBoard';
import { PlayerCard } from '../../components/game/PlayerCard';
import { type } from '../../design-system/typography';
import { useBackGuard } from '../../hooks/useBackGuard';
import { useLocalGameRunner } from '../../hooks/useLocalGameRunner';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { seatsOf, useLocalGameStore } from '../../store/localGameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatDurationMs } from '../../utils/format';

export const OfflineBoardScreen: React.FC<RootScreenProps<'offline_board'>> = () => {
  const { nav, goHome } = useAppNav();
  const c = useTheme();
  const game = useLocalGameStore((s) => s.game);
  const setup = useLocalGameStore((s) => s.setup);
  const paused = useLocalGameStore((s) => s.paused);
  const lastMove = useLocalGameStore((s) => s.lastMove);
  const sound = useSettingsStore((s) => s.soundEffects);
  const setSettings = useSettingsStore((s) => s.set);
  const inProgress = game?.outcome.status === 'IN_PROGRESS';

  const guard = useBackGuard({
    when: !!game && inProgress && !paused,
    title: 'Leave Match?',
    message: 'Your current round progress will be discarded.',
    confirmLabel: 'Exit',
    onLeave: () => useLocalGameStore.getState().quit(),
  });

  const { elapsedMs, aiThinking } = useLocalGameRunner(() => {
    guard.allow();
    nav.replace('game_result');
  });

  const missing = game === null;
  useEffect(() => {
    if (missing) {
      guard.allow();
      goHome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  const s = useThemedStyles((t) => ({
    body: { flex: 1, justifyContent: 'space-between', gap: 16 },
    cards: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
    status: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, backgroundColor: t.bgCard, borderColor: t.border },
    controls: { flexDirection: 'row', gap: 10 },
  }));

  if (!game) return null;
  const seats = seatsOf(setup);
  const isVsAi = game.mode === 'VS_AI';
  const out = game.outcome;
  const nameOf = (mark: 'X' | 'O') => seats[mark].name;
  const statusText =
    out.status === 'WIN'
      ? `${nameOf(out.winner)} Wins`
      : out.status === 'DRAW'
        ? 'Round ended in a Draw'
        : paused
          ? 'Paused'
          : `Turn: ${nameOf(game.current)} (${game.current})`;
  const subtitleFor = (mark: 'X' | 'O') => (isVsAi ? (seats[mark].isP1 ? 'You' : 'AI Bot') : seats[mark].isP1 ? 'Player 1' : 'Player 2');
  const activeLabelFor = (mark: 'X' | 'O') => (isVsAi ? (seats[mark].isP1 ? 'Your Turn' : 'Thinking...') : 'Your Turn');
  const boardLocked = !inProgress || paused || aiThinking;

  return (
    <Screen
      title={isVsAi ? `vs AI · ${game.difficulty ?? 'MEDIUM'}` : 'Offline Match'}
      subtitle={`${game.config.size}x${game.config.size} Grid · ${game.config.winLength} in a row`}
      onBack={() => nav.goBack()}
      scroll={false}
      rightAction={
        <AppIconButton
          testID="board-pause"
          label="Pause game"
          icon={<Pause size={16} color={c.text} />}
          disabled={!inProgress}
          onPress={() => {
            useLocalGameStore.getState().pause();
            nav.navigate('game_pause');
          }}
        />
      }
      testID="offline-board"
    >
      <View style={s.body}>
        <View style={s.cards}>
          {(['X', 'O'] as const).map((mark) => (
            <PlayerCard
              key={mark}
              name={seats[mark].name}
              avatarId={seats[mark].avatar}
              symbol={mark}
              score={game.scores[mark]}
              isActive={inProgress && game.current === mark}
              activeLabel={activeLabelFor(mark)}
              subtitle={subtitleFor(mark)}
            />
          ))}
        </View>

        <View style={s.status}>
          <Text testID="board-status" style={[type.small, { color: c.textSecondary, flex: 1 }]} numberOfLines={1}>
            {statusText}
          </Text>
          <Text style={[type.caption, { color: c.textSecondary, marginRight: 12 }]}>Draws {game.scores.draws}</Text>
          <Text testID="board-timer" accessibilityLabel={`Elapsed ${formatDurationMs(elapsedMs)}`} style={[type.num, { color: c.text }]}>
            {formatDurationMs(elapsedMs)}
          </Text>
        </View>

        <View style={styles.boardWrap}>
          <GameBoard
            board={game.board}
            size={game.config.size}
            winningLine={out.status === 'WIN' ? out.line : null}
            lastMoveIndex={lastMove}
            disabled={boardLocked}
            onCellPress={(i) => useLocalGameStore.getState().play(i)}
          />
        </View>

        <View style={s.controls}>
          <AppButton
            testID="board-undo"
            title="Undo"
            variant="secondary"
            size="md"
            style={styles.flex}
            icon={<Undo2 size={16} color={c.text} />}
            disabled={game.moves.length === 0 || paused}
            onPress={() => useLocalGameStore.getState().undoMove()}
          />
          <AppButton
            testID="board-restart"
            title="Restart"
            variant="secondary"
            size="md"
            style={styles.flex}
            icon={<RotateCcw size={16} color={c.text} />}
            onPress={() => useLocalGameStore.getState().rematch()}
          />
          <AppButton
            testID="board-mute"
            title={sound ? 'Mute' : 'Unmute'}
            variant="outline"
            size="md"
            style={styles.flex}
            icon={sound ? <Volume2 size={16} color={c.text} /> : <VolumeX size={16} color={c.text} />}
            onPress={() => setSettings({ soundEffects: !sound })}
          />
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  boardWrap: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
