import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { AppButton } from '../common/AppButton';
import { ConfirmDialog } from '../common/AppModal';

import { ch, fs, MIN_TOUCH, ms } from '../../design-system/responsive';
/**
 * In-game pause overlay. It is a plain view laid over the board (not a native Modal and not a separate route), so it is
 * a pure function of the store's `paused` flag: whatever paused the game, the player always gets a Resume button.
 * It is opaque on purpose so the position cannot be studied while the clock is stopped.
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
}> = ({ matchLabel, elapsedLabel, reason, onResume, onRestart, onExit }) => {
  const c = useTheme();
  const [confirmQuit, setConfirmQuit] = useState(false);

  return (
    <View testID="game-pause" style={[styles.fill, { backgroundColor: c.scrim }]} accessibilityViewIsModal importantForAccessibility="yes">
      <View style={[styles.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>Game Paused</Text>
          <Text testID="pause-detail" style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>
            {matchLabel} · {elapsedLabel}
          </Text>
          {reason === 'interrupted' ? (
            <Text style={[styles.note, { color: c.textSecondary }]}>The game was paused while you were away.</Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          <AppButton testID="pause-resume" fullWidth size="md" title="Resume" onPress={onResume} style={styles.btn} />
          <AppButton testID="pause-restart" fullWidth size="md" variant="secondary" title="Restart" onPress={onRestart} style={styles.btn} />
          <AppButton testID="pause-quit" fullWidth size="md" variant="ghost" title="Quit to Home" onPress={() => setConfirmQuit(true)} style={styles.btnSm} />
        </View>
      </View>

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
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 10, elevation: 10 },
  card: { width: '100%', maxWidth: ms(320), borderRadius: 20, borderWidth: 1, padding: ms(20), gap: ms(14), alignItems: 'center' },
  titles: { alignItems: 'center', gap: 2 },
  title: { fontSize: fs(17), fontFamily: fonts.body.semibold },
  sub: { fontSize: fs(12), fontFamily: fonts.mono.medium },
  note: { fontSize: fs(12), textAlign: 'center', marginTop: 4 },
  actions: { gap: 8, alignSelf: 'stretch' },
  btn: { minHeight: ch(40), borderRadius: 12 },
  btnSm: { minHeight: MIN_TOUCH, borderRadius: 12 },
});
