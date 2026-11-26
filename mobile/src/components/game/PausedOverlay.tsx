import React, { useState } from 'react';
import { Text } from 'react-native';
import { ConfirmDialog } from '../common/AppModal';
import { Popup } from '../common/Popup';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';

/**
 * In-game pause popup. Logic only here (resume, restart, sound, quit confirmation); the look comes from the shared Popup
 * in overlay mode, so it covers the board, cannot be dismissed by tapping outside, and always offers Resume.
 */
export const PausedOverlay: React.FC<{
  matchLabel: string;
  elapsedLabel: string;
  /** `interrupted` = the app was left (background, lock, call); `manual` = the Pause button. */
  reason: 'manual' | 'interrupted' | null;
  onResume: () => void;
  onRestart: () => void;
  onSettings?: () => void;
  onExit: () => void;
  /** Current Sound Effects setting, and the toggle (same setting as Settings → Sound Effects). */
  soundOn: boolean;
  onToggleSound: () => void;
}> = ({ matchLabel, elapsedLabel, reason, onResume, onRestart, onExit, soundOn, onToggleSound }) => {
  const c = useTheme();
  const [confirmQuit, setConfirmQuit] = useState(false);

  return (
    <>
      <Popup
        presentation="overlay"
        open
        testID="game-pause"
        title="Game Paused"
        message={`${matchLabel} · ${elapsedLabel}`}
        messageTestID="pause-detail"
        actions={[
          { testID: 'pause-resume', label: 'Resume', variant: 'primary', onPress: onResume },
          { testID: 'pause-restart', label: 'Restart', variant: 'secondary', onPress: onRestart },
          { testID: 'pause-sound', label: soundOn ? 'Sound Effects: On' : 'Sound Effects: Off', variant: 'secondary', onPress: onToggleSound },
          { testID: 'pause-quit', label: 'Quit to Home', variant: 'ghost', onPress: () => setConfirmQuit(true) },
        ]}
      >
        {reason === 'interrupted' ? <Text style={[type.caption, { color: c.textSecondary, textAlign: 'center' }]}>The game was paused while you were away.</Text> : null}
      </Popup>

      <ConfirmDialog
        open={confirmQuit}
        title="Quit Match?"
        message="You will lose this round."
        confirmLabel="Quit"
        cancelLabel="Keep Playing"
        destructive
        onCancel={() => setConfirmQuit(false)}
        onConfirm={() => {
          setConfirmQuit(false);
          onExit();
        }}
      />
    </>
  );
};
