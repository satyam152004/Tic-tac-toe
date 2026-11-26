import { Lightbulb, Pause, Undo2 } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIconButton } from '../common/AppIconButton';
import { Screen } from '../common/Screen';
import { iconSize } from '../../design-system/icons';
import { fs, ms } from '../../design-system/responsive';
import { space } from '../../design-system/spacing';
import { fonts, type } from '../../design-system/typography';
import { useGameLayout } from '../../hooks/useGameLayout';
import { useTheme } from '../../hooks/useTheme';
import { BoardArea } from './BoardArea';
import { ControlBar, ControlTile } from './ControlBar';
import { SymbolMark } from './SymbolMark';

/**
 * THE game board screen UI, used by every mode (Pass n play, vs Computer, online, friend rooms).
 * The mode decides which controls appear here, in one place:
 *  - `local`:  pause (||) in the header, plus Undo / Hint / Restart.
 *  - `online`: no pause; Offer draw and Give up.
 * Screens only supply data and callbacks.
 */

export interface BoardSeat {
  name: string;
  symbol: 'X' | 'O';
  /** Second line under the name, e.g. "Score 2" or "Rating 1200". */
  subtitle: string;
  isActive: boolean;
  testID?: string;
}

export type BoardControls =
  | {
      mode: 'local';
      onPause: () => void;
      pauseDisabled: boolean;
      onUndo: () => void;
      undoDisabled: boolean;
      onHint: () => void;
      hintsLeft: number;
      hintDisabled: boolean;
      onRestart: () => void;
      restartDisabled: boolean;
    }
  | {
      mode: 'online';
      onOfferDraw: () => void;
      offerDrawDisabled: boolean;
      onGiveUp: () => void;
      giveUpDisabled: boolean;
    };

export interface GameBoardViewProps {
  testID: string;
  title: string;
  subtitle?: string;
  onBack: () => void;
  controls: BoardControls;
  /** Full-screen overlay (paused, reconnecting). */
  overlay?: React.ReactNode;
  /** Shown above the seats (e.g. opponent disconnected). */
  banner?: React.ReactNode;
  /** Optional turn-progress bar, 0–100. Omit to hide. */
  progress?: number;
  seats: [BoardSeat, BoardSeat];
  turnText: string;
  clock: string;
  clockTestID: string;
  board: Omit<React.ComponentProps<typeof BoardArea>, 'initial'>;
  /** Modals and dialogs for this screen. */
  children?: React.ReactNode;
}

const Seat: React.FC<{ seat: BoardSeat }> = ({ seat }) => {
  const c = useTheme();
  return (
    <View
      testID={seat.testID}
      accessibilityLabel={`${seat.name}, ${seat.symbol}, ${seat.subtitle}${seat.isActive ? ', active turn' : ''}`}
      style={[
        styles.seat,
        seat.isActive ? { borderColor: c.accent, backgroundColor: c.bgElevated } : { borderColor: c.border, backgroundColor: c.bgCard },
      ]}
    >
      <SymbolMark value={seat.symbol} size={ms(18)} glow={seat.isActive} animate={false} />
      <View style={styles.seatText}>
        <Text numberOfLines={1} style={[type.bodyStrong, { color: c.text }]}>{seat.name}</Text>
        <Text numberOfLines={1} style={[type.caption, { color: c.textSecondary }]}>{seat.subtitle}</Text>
      </View>
    </View>
  );
};

export const GameBoardView: React.FC<GameBoardViewProps> = (p) => {
  const c = useTheme();
  const layout = useGameLayout();
  const k = p.controls;

  const rightAction =
    k.mode === 'local' ? (
      <AppIconButton
        testID="board-pause"
        label="Pause game"
        icon={<Pause size={iconSize.sm} color={c.text} />}
        disabled={k.pauseDisabled}
        onPress={k.onPause}
      />
    ) : undefined;

  const actions =
    k.mode === 'local'
      ? [
          { testID: 'board-undo', label: 'Undo', icon: <Undo2 size={iconSize.sm} color={c.text} />, disabled: k.undoDisabled, onPress: k.onUndo },
          { testID: 'board-hint', label: `Hint (${k.hintsLeft})`, icon: <Lightbulb size={iconSize.sm} color={c.text} />, disabled: k.hintDisabled, onPress: k.onHint },
          { testID: 'board-restart', label: 'Restart', icon: null, disabled: k.restartDisabled, onPress: k.onRestart },
        ]
      : [
          { testID: 'offer-draw', label: 'Offer draw', icon: null, disabled: k.offerDrawDisabled, onPress: k.onOfferDraw },
          { testID: 'forfeit', label: 'Give up', icon: null, disabled: k.giveUpDisabled, onPress: k.onGiveUp },
        ];

  return (
    <Screen
      testID={p.testID}
      title={p.title}
      subtitle={p.subtitle}
      onBack={p.onBack}
      // The page scrolls only when the board cannot keep 44dp cells; otherwise the board area absorbs the leftover height.
      contentStyle={styles.grow}
      gutter={layout.gutter}
      gap={layout.gap}
      rightAction={rightAction}
      overlay={p.overlay}
    >
      <View style={[styles.body, { gap: layout.gap }]}>
        {p.progress !== undefined ? (
          <View style={[styles.progressTrack, { backgroundColor: c.bgSecondary }]}>
            <View style={[styles.progressFill, { width: `${p.progress}%`, backgroundColor: c.accent }]} />
          </View>
        ) : null}

        {p.banner}

        <View style={styles.seats}>
          <Seat seat={p.seats[0]} />
          <Seat seat={p.seats[1]} />
        </View>

        <View style={[styles.turnBar, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[type.body, { color: c.text }]} numberOfLines={1}>{p.turnText}</Text>
          <Text testID={p.clockTestID} style={[styles.clock, { color: c.text }]}>{p.clock}</Text>
        </View>

        <BoardArea initial={layout.estimate} {...p.board} />

        <ControlBar stacked={layout.stackedControls}>
          {actions.map((a) => (
            <ControlTile
              key={a.testID}
              inline
              testID={a.testID}
              label={a.label}
              icon={a.icon}
              disabled={a.disabled}
              onPress={a.onPress}
            />
          ))}
        </ControlBar>
      </View>
      {p.children}
    </Screen>
  );
};

const styles = StyleSheet.create({
  // flexGrow (not flex: 1): inside a ScrollView a zero flex-basis collapses.
  grow: { flexGrow: 1 },
  body: { flexGrow: 1 },
  progressTrack: { height: ms(4.8), borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  seats: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
  seat: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  seatText: { flex: 1, minWidth: 0 },
  turnBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  clock: { fontFamily: fonts.mono.semibold, fontSize: fs(15), fontVariant: ['tabular-nums'] },
});
