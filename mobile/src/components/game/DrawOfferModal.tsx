import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Popup } from '../common/Popup';
import { radius } from '../../design-system/radius';
import { space } from '../../design-system/spacing';
import { type } from '../../design-system/typography';
import { formatClock, useCountdown } from '../../hooks/useOnlineGame';
import { useTheme } from '../../hooks/useTheme';

export interface DrawOfferModalProps {
  open: boolean;
  proposerName?: string;
  /** ISO time the offer lapses (server clock, from `game:draw-offered`). */
  expiresAt?: string | null;
  /** Move number the offer was made on. */
  moveCount?: number;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Incoming draw offer. Logic only here (countdown, auto-decline); the look comes from the shared Popup.
 */
export const DrawOfferModal: React.FC<DrawOfferModalProps> = ({ open, proposerName = 'Your opponent', expiresAt, moveCount, onAccept, onDecline }) => {
  const c = useTheme();
  const target = open && expiresAt ? Date.parse(expiresAt) : null;
  const seconds = useCountdown(Number.isFinite(target) ? target : null);

  // The offer lapses on the server too; closing the popup at zero keeps both sides in sync.
  useEffect(() => {
    if (open && seconds === 0) onDecline();
  }, [open, seconds, onDecline]);

  return (
    <Popup
      open={open}
      title="Draw offer"
      message={`${proposerName} offered a draw${moveCount ? ` on move ${moveCount}` : ''}. Your rating will not change.`}
      badge={
        seconds !== null ? (
          <View style={[styles.badge, { backgroundColor: c.dangerSoft, borderColor: c.dangerBorder }]}>
            <Text style={[type.caption, { color: c.dangerText }]}>Expires in {formatClock(seconds)}</Text>
          </View>
        ) : undefined
      }
      onDismiss={onDecline}
      actions={[
        { testID: 'draw-decline', label: 'Decline', variant: 'secondary', onPress: onDecline },
        { testID: 'draw-accept', label: 'Accept Draw', variant: 'primary', onPress: onAccept },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  badge: { alignSelf: 'center', paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.sm, borderWidth: 1 },
});
