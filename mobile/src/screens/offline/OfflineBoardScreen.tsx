import { Pause, RotateCcw, Undo2, Volume2, VolumeX } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIconButton } from '../../components/common/AppIconButton';
import { Screen } from '../../components/common/Screen';
import { BoardArea } from '../../components/game/BoardArea';
import { ControlBar, ControlTile } from '../../components/game/ControlBar';
import { PausedOverlay } from '../../components/game/PausedOverlay';
import { PlayerCard } from '../../components/game/PlayerCard';
import { iconSize } from '../../design-system/icons';
import { radius } from '../../design-system/radius';
import { space } from '../../design-system/spacing';
import { type } from '../../design-system/typography';
import { useBackGuard } from '../../hooks/useBackGuard';
import { useGameLayout } from '../../hooks/useGameLayout';
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
    status: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, backgroundColor: t.bgCard, borderColor: t.border },
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
            <PlayerCard
              key={mark}
              name={seats[mark].name}
              avatarId={seats[mark].avatar}
              symbol={mark}
              score={game.scores[mark]}
              isActive={inProgress && game.current === mark}
              activeLabel={activeLabelFor(mark)}
              subtitle={subtitleFor(mark)}
              dense={dense}
            />
          ))}
        </View>

        <View style={[s.status, { paddingVertical: dense ? space.xs : space.sm }]}>
          {/* Wraps instead of truncating: long names and large system fonts stay readable. */}
          <Text testID="board-status" style={[type.small, { color: c.textSecondary, flex: 1 }]}>
            {statusText}
          </Text>
          <Text style={[type.caption, { color: c.textSecondary }]}>Draws {game.scores.draws}</Text>
          <Text testID="board-timer" accessibilityLabel={`Elapsed ${formatDurationMs(elapsedMs)}`} style={[type.num, { color: c.text }]}>
            {formatDurationMs(elapsedMs)}
          </Text>
        </View>

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
            testID="board-undo"
            label="Undo"
            icon={<Undo2 size={iconSize.md} color={c.text} />}
            disabled={game.moves.length === 0 || paused || !inProgress}
            onPress={() => useLocalGameStore.getState().undoMove()}
          />
          <ControlTile
            testID="board-restart"
            label="Restart"
            icon={<RotateCcw size={iconSize.md} color={c.text} />}
            disabled={!inProgress}
            onPress={() => useLocalGameStore.getState().rematch()}
          />
          <ControlTile
            testID="board-mute"
            label={sound ? 'Mute' : 'Unmute'}
            icon={sound ? <Volume2 size={iconSize.md} color={c.text} /> : <VolumeX size={iconSize.md} color={c.text} />}
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
