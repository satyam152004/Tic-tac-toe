import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../common/AppButton';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';

export interface DrawOfferModalProps {
  open: boolean;
  proposerName?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const DrawOfferModal: React.FC<DrawOfferModalProps> = ({
  open,
  proposerName = 'Aarav Patel',
  onAccept,
  onDecline,
}) => {
  const c = useTheme();
  const [seconds, setSeconds] = useState(18);

  useEffect(() => {
    if (!open) {
      setSeconds(18);
      return;
    }
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          onDecline();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [open, onDecline]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={styles.timerBadge}>
            <Text style={styles.timerBadgeText}>
              Expires in 00:{String(seconds).padStart(2, '0')}
            </Text>
          </View>

          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[styles.title, { color: c.text }]}>Draw Offered</Text>
            <Text style={[styles.desc, { color: c.textSecondary }]}>
              <Text style={{ fontFamily: fonts.body.semibold, color: c.text }}>{proposerName}</Text>{' '}
              proposed a mutual draw on Move 6 (0 ELO change).
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
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppButton
                testID="draw-accept"
                title="Accept Draw"
                variant="primary"
                size="md"
                onPress={onAccept}
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
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 290,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  timerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#EFF4FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  timerBadgeText: {
    fontSize: 10.5,
    fontFamily: fonts.mono.semibold,
    color: '#1D4ED8',
  },
  title: {
    fontSize: 17,
    fontFamily: fonts.body.semibold,
  },
  desc: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    paddingTop: 4,
  },
});
