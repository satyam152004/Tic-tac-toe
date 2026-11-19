import { Pause, Play, RotateCcw, Settings } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { AppButton } from '../common/AppButton';
import { AppCard } from '../common/AppCard';
import { ConfirmDialog } from '../common/AppModal';

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
  onSettings: () => void;
  onExit: () => void;
}> = ({ matchLabel, elapsedLabel, reason, onResume, onRestart, onSettings, onExit }) => {
  const c = useTheme();
  const [confirmQuit, setConfirmQuit] = useState(false);

  return (
    <View testID="game-pause" style={[styles.fill, { backgroundColor: c.bgPrimary }]} accessibilityViewIsModal importantForAccessibility="yes">
      <AppCard padding="lg" style={styles.card}>
        <View style={[styles.badge, { backgroundColor: c.bgElevated, borderColor: c.border }]}>
          <Pause size={24} color={c.accent} />
        </View>
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[type.heading, { color: c.text }]}>Game Paused</Text>
          <Text testID="pause-detail" style={[type.body, { color: c.textSecondary, textAlign: 'center' }]}>
            {reason === 'interrupted' ? 'The game was paused while you were away.' : 'Take your time. The clock is stopped.'}
          </Text>
          <Text style={[type.small, { color: c.textSecondary, textAlign: 'center' }]} numberOfLines={1}>
            {matchLabel} · {elapsedLabel}
          </Text>
        </View>
        <View style={styles.actions}>
          <AppButton testID="pause-resume" fullWidth title="Resume Game" icon={<Play size={16} color="#FFFFFF" />} onPress={onResume} />
          <AppButton testID="pause-restart" fullWidth variant="secondary" title="Restart Match" icon={<RotateCcw size={16} color={c.text} />} onPress={onRestart} />
          <AppButton testID="pause-settings" fullWidth variant="secondary" title="Settings" icon={<Settings size={16} color={c.text} />} onPress={onSettings} />
          <AppButton testID="pause-quit" fullWidth variant="outline" title="Exit to Home" onPress={() => setConfirmQuit(true)} />
        </View>
      </AppCard>

      <ConfirmDialog
        open={confirmQuit}
        title="Quit Match?"
        message="Your current round progress will be discarded."
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
  fill: { ...StyleSheet.absoluteFill, justifyContent: 'center', padding: 20, zIndex: 10, elevation: 10 },
  card: { gap: 20, alignItems: 'center' },
  badge: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  titles: { alignItems: 'center', gap: 4 },
  actions: { gap: 10, alignSelf: 'stretch' },
});
