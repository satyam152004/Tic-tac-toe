import { Pause, Undo2, Volume2, VolumeX } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIconButton } from '../../components/common/AppIconButton';
import { Screen } from '../../components/common/Screen';
import { BoardArea } from '../../components/game/BoardArea';
import { ControlBar, ControlTile } from '../../components/game/ControlBar';
import { PausedOverlay } from '../../components/game/PausedOverlay';
import { ScoreChip } from '../../components/game/PlayerCard';
import { SegmentedControl } from '../../components/game/SegmentedControl';
import { iconSize } from '../../design-system/icons';
import { space } from '../../design-system/spacing';
import { useBackGuard } from '../../hooks/useBackGuard';
import { useGameLayout } from '../../hooks/useGameLayout';
import { useLocalGameRunner } from '../../hooks/useLocalGameRunner';
import { useTheme } from '../../hooks/useTheme';
import { RootScreenProps } from '../../navigation/types';
import { useAppNav } from '../../navigation/useAppNav';
import { seatsOf, useLocalGameStore } from '../../store/localGameStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatDurationMs } from '../../utils/format';

const AI_LABEL = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard', EXPERT: 'Expert', IMPOSSIBLE: 'Unbeatable' } as const;

const SIZES = [3, 4, 5].map((n) => ({ value: n as 3 | 4 | 5, label: `${n}×${n}`, testID: `board-size-${n}` }));

export const OfflineBoardScreen: React.FC<RootScreenProps<'offline_board'>> = () => {
  const { nav, goHome } = useAppNav();
  const c = useTheme();
  const layout = useGameLayout();
  const dense = layout.density === 'compact';
  const game = useLocalGameStore((s) => s.game);
  const setup = useLocalGameStore((s) => s.setup);
  const paused = useLocalGameStore((s) => s.paused);
  const pauseReason = useLocalGameStore((s) => s.pauseReason);
  const lastMove = useLocalGameStore((s) => s.lastMove);
  const sound = useSettingsStore((s) => s.soundEffects);
  const setSettings = useSettingsStore((s) => s.set);
  const inProgress = game?.outcome.status === 'IN_PROGRESS';

  // Also while paused: leaving a paused match still discards it, so it is confirmed like any other exit.
  const guard = useBackGuard({
    when: !!game && inProgress,
    title: 'Leave Match?',
    message: 'You will lose this round.',
    confirmLabel: 'Leave',
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

  if (!game) return null;
  const seats = seatsOf(setup);
  const isVsAi = game.mode === 'VS_AI';
  const out = game.outcome;
  const nameOf = (mark: 'X' | 'O') => seats[mark].name;
  const statusText =
    out.status === 'WIN'
      ? `${nameOf(out.winner)} Wins`
      : out.status === 'DRAW'
        ? 'Draw'
        : paused
          ? 'Paused'
          : isVsAi
            ? game.current === game.humanMark
              ? `Your turn (${game.current})`
              : 'AI is thinking...'
            : `${nameOf(game.current)} (${game.current})`;
  const nameForChip = (mark: 'X' | 'O') => (isVsAi && !seats[mark].isP1 ? `AI ${AI_LABEL[game.difficulty ?? 'MEDIUM']}` : nameOf(mark));
  const boardLocked = !inProgress || paused || aiThinking;

  return (
    <Screen
      title={statusText}
      onBack={() => nav.goBack()}
      // The page scrolls only when the board cannot keep 44dp cells; otherwise the board area absorbs the leftover height.
      contentStyle={styles.grow}
      gutter={layout.gutter}
      gap={layout.gap}
      rightAction={
        <AppIconButton
          testID="board-pause"
          label="Pause game"
          icon={<Pause size={iconSize.sm} color={c.text} />}
          disabled={!inProgress || paused}
          onPress={() => useLocalGameStore.getState().pause('manual')}
        />
      }
      overlay={
        paused && inProgress ? (
          <PausedOverlay
            matchLabel={`${seats.X.name} vs ${seats.O.name}`}
            elapsedLabel={formatDurationMs(elapsedMs)}
            reason={pauseReason}
            onResume={() => useLocalGameStore.getState().unpause()}
            onRestart={() => useLocalGameStore.getState().rematch()}
            onSettings={() => nav.navigate('settings')}
            onExit={() => {
              // quit() empties the store; allow the back guard first so leaving does not ask a second time.
              guard.allow();
              useLocalGameStore.getState().quit();
              goHome();
            }}
          />
        ) : null
      }
      testID="offline-board"
    >
      <View style={[styles.body, { gap: layout.gap }]}>
        <View style={styles.cards}>
          {(['X', 'O'] as const).map((mark) => (
            <ScoreChip
              key={mark}
              testID={`board-score-${mark}`}
              name={nameForChip(mark)}
              symbol={mark}
              score={game.scores[mark]}
              isActive={inProgress && game.current === mark}
            />
          ))}
        </View>

        <SegmentedControl
          size="sm"
          label="Board size"
          options={SIZES}
          value={game.config.size}
          onChange={(n) => {
            // A different grid is a different game: it starts a fresh round (scores reset) on the new size.
            const store = useLocalGameStore.getState();
            store.configure({ size: n, winLength: undefined });
            store.start();
          }}
        />

        <BoardArea
          initial={layout.estimate}
          board={game.board}
          size={game.config.size}
          winningLine={out.status === 'WIN' ? out.line : null}
          lastMoveIndex={lastMove}
          disabled={boardLocked}
          onCellPress={(i) => useLocalGameStore.getState().play(i)}
        />

        <ControlBar stacked={layout.stackedControls}>
          <ControlTile
            inline
            testID="board-undo"
            label="Undo"
            icon={<Undo2 size={iconSize.sm} color={c.text} />}
            disabled={game.moves.length === 0 || paused || !inProgress}
            onPress={() => useLocalGameStore.getState().undoMove()}
          />
          <ControlTile
            inline
            testID="board-restart"
            label="Restart"
            icon={null}
            disabled={!inProgress}
            onPress={() => useLocalGameStore.getState().rematch()}
          />
          <ControlTile
            inline
            testID="board-mute"
            label={sound ? 'Sound On' : 'Muted'}
            icon={sound ? <Volume2 size={iconSize.sm} color={c.text} /> : <VolumeX size={iconSize.sm} color={c.text} />}
            onPress={() => setSettings({ soundEffects: !sound })}
          />
        </ControlBar>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  // flexGrow (not flex: 1): inside a ScrollView a zero flex-basis collapses.
  grow: { flexGrow: 1 },
  body: { flexGrow: 1 },
  cards: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
});
