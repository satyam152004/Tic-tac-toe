import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../common/AppButton';
import { fonts } from '../../design-system/typography';
import { formatClock, useCountdown } from '../../hooks/useOnlineGame';
import { useTheme } from '../../hooks/useTheme';

import { ch, fs, ms } from '../../design-system/responsive';
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

export const DrawOfferModal: React.FC<DrawOfferModalProps> = ({
  open,
  proposerName = 'Your opponent',
  expiresAt,
  moveCount,
  onAccept,
  onDecline,
}) => {
  const c = useTheme();
  const target = open && expiresAt ? Date.parse(expiresAt) : null;
  const seconds = useCountdown(Number.isFinite(target) ? target : null);

  // The offer lapses on the server too; closing the dialog at zero keeps both sides in sync.
  useEffect(() => {
    if (open && seconds === 0) onDecline();
  }, [open, seconds, onDecline]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {seconds !== null ? (
            <View style={styles.timerBadge}>
              <Text style={styles.timerBadgeText}>Expires in {formatClock(seconds)}</Text>
            </View>
          ) : null}

          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[styles.title, { color: c.text }]}>Draw offer</Text>
            <Text style={[styles.desc, { color: c.textSecondary }]}>
              <Text style={{ fontFamily: fonts.body.semibold, color: c.text }}>{proposerName}</Text>{' '}
              offered a draw{moveCount ? ` on move ${moveCount}` : ''}. Your rating will not change.
            </Text>
          </View>

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <AppButton
                testID="draw-decline"
                title="Decline"
                variant="secondary"
                size="md"
                onPress={onDecline}
                style={{ minHeight: ch(40) }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppButton
                testID="draw-accept"
                title="Accept Draw"
                variant="primary"
                size="md"
                onPress={onAccept}
                style={{ minHeight: ch(40) }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(20, 21, 24, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: ms(20),
  },
  card: {
    width: '100%',
    maxWidth: ms(320),
    borderRadius: 20,
    borderWidth: 1,
    padding: ms(20),
    alignItems: 'center',
    gap: ms(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  timerBadge: {
    paddingHorizontal: ms(10),
    paddingVertical: ms(4),
    borderRadius: 999,
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  timerBadgeText: {
    fontSize: fs(12),
    fontFamily: fonts.mono.semibold,
    color: '#1D4ED8',
  },
  title: {
    fontSize: fs(17),
    fontFamily: fonts.body.semibold,
  },
  desc: {
    fontSize: fs(12),
    lineHeight: Math.round(fs(12) * 1.35),
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: ms(10),
    width: '100%',
    paddingTop: 4,
  },
});
