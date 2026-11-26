import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius } from '../../design-system/radius';
import { space } from '../../design-system/spacing';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import type { BoardSize } from '../../services/api/types';
import { AppButton } from '../common/AppButton';
import { Popup } from '../common/Popup';
import { AppLoader } from '../feedback/AppLoader';
import { EmptyState, ErrorState } from '../feedback/StateViews';
import { BoardCell, GameBoard } from './GameBoard';

/**
 * THE match replay UI, used for every saved match (local history and online). Callers turn their data into
 * `ReplayStatus`; this file draws the popup, the board and the Prev / Next stepper.
 */

export type ReplayCell = BoardCell;

export type ReplayStatus =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; offline: boolean; onRetry: () => void }
  | { kind: 'empty' }
  | {
      kind: 'ready';
      /** Line under the title, e.g. "Satyam vs Vortex AI · 3×3". */
      subtitle: string;
      board: ReplayCell[];
      size: BoardSize;
      winningLine: number[] | null;
      lastMoveIndex: number | null;
      step: number;
      total: number;
      onPrev: () => void;
      onNext: () => void;
    };

export interface GameReplayViewProps {
  open: boolean;
  onClose: () => void;
  status: ReplayStatus;
}

export const GameReplayView: React.FC<GameReplayViewProps> = ({ open, onClose, status }) => {
  const c = useTheme();
  return (
    <Popup open={open} title="Match Replay" onDismiss={onClose} testID="game-replay">
      {status.kind === 'loading' ? (
        <AppLoader />
      ) : status.kind === 'error' ? (
        <ErrorState offline={status.offline} message={status.message} onRetry={status.onRetry} />
      ) : status.kind === 'empty' ? (
        <EmptyState title="No moves saved" description="This match was saved without its moves, so it can't be replayed." />
      ) : (
        <View style={styles.body}>
          <View style={styles.header}>
            <Text numberOfLines={1} style={[type.caption, styles.subtitle, { color: c.textSecondary }]}>
              {status.subtitle}
            </Text>
            <View style={[styles.stepChip, { backgroundColor: c.bgElevated }]}>
              <Text testID="replay-step" style={[type.num, { color: c.accent }]}>
                {status.step}/{status.total}
              </Text>
            </View>
          </View>

          <View style={styles.boardWrap}>
            <GameBoard
              compact
              disabled
              board={status.board}
              size={status.size}
              winningLine={status.step === status.total ? status.winningLine : null}
              lastMoveIndex={status.lastMoveIndex}
              maxSize={180}
            />
          </View>

          <View style={styles.stepper}>
            <AppButton testID="replay-prev" title="← Prev" variant="secondary" size="md" disabled={status.step === 0} onPress={status.onPrev} style={styles.flex} />
            <AppButton testID="replay-next" title="Next →" size="md" disabled={status.step === status.total} onPress={status.onNext} style={styles.flex} />
          </View>
        </View>
      )}
    </Popup>
  );
};

const styles = StyleSheet.create({
  body: { gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  subtitle: { flex: 1 },
  stepChip: { paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.sm },
  boardWrap: { alignItems: 'center' },
  stepper: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
