import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Gamepad2, WifiOff } from 'lucide-react-native';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { AppButton } from '../common/AppButton';
import { ms } from '../../design-system/responsive';
import { AppCard } from '../common/AppCard';

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}> = ({ title, description, actionLabel, onAction, icon }) => {
  const c = useTheme();
  return (
    <View style={styles.fill}>
      <AppCard padding="lg" style={styles.card}>
        <View style={[styles.icon, { backgroundColor: c.bgElevated, borderColor: c.border }]}>{icon ?? <Gamepad2 size={ms(26)} color={c.accent} />}</View>
        <Text style={[type.heading, { color: c.text, textAlign: 'center' }]}>{title}</Text>
        <Text style={[type.body, { color: c.textSecondary, textAlign: 'center' }]}>{description}</Text>
        {actionLabel && onAction ? <AppButton title={actionLabel} size="md" onPress={onAction} style={{ marginTop: 4 }} /> : null}
      </AppCard>
    </View>
  );
};

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  offline?: boolean;
}> = ({ title, message, retryLabel = 'Try Again', onRetry, offline }) => {
  const c = useTheme();
  return (
    <View style={styles.fill}>
      <AppCard padding="lg" style={[styles.card, { borderColor: c.dangerBorder }]}>
        <View style={[styles.icon, { backgroundColor: c.dangerSoft, borderColor: c.dangerBorder }]}>
          {offline ? <WifiOff size={ms(26)} color={c.dangerText} /> : <AlertTriangle size={ms(26)} color={c.dangerText} />}
        </View>
        <Text style={[type.heading, { color: c.text, textAlign: 'center' }]}>{title ?? (offline ? "You're offline" : 'Something went wrong')}</Text>
        <Text style={[type.body, { color: c.textSecondary, textAlign: 'center' }]}>{message}</Text>
        {onRetry ? <AppButton title={retryLabel} variant="secondary" size="md" onPress={onRetry} /> : null}
      </AppCard>
    </View>
  );
};

const styles = StyleSheet.create({
  // Fills the space the state sits in and centers it vertically and horizontally.
  fill: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  card: { alignItems: 'center', gap: 10 },
  icon: { width: ms(56), height: ms(56), borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
