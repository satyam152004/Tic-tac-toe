import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Coins } from 'lucide-react-native';
import { AppButton } from '../common/AppButton';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';

export interface GuestUpgradeModalProps {
  open: boolean;
  onUpgrade: () => void;
  onDismiss: () => void;
}

export const GuestUpgradeModal: React.FC<GuestUpgradeModalProps> = ({
  open,
  onUpgrade,
  onDismiss,
}) => {
  const c = useTheme();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={styles.bonusBadge}>
            <Coins size={12} color="#B45309" />
            <Text style={styles.bonusText}>+200 Bonus Coins</Text>
          </View>

          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[styles.title, { color: c.text }]}>Save Your Progress</Text>
            <Text style={[styles.desc, { color: c.textSecondary }]}>
              Guest progress stays on this device only. Link an account to play Ranked 1v1 and keep your{' '}
              <Text style={{ fontFamily: fonts.body.semibold, color: c.text }}>1,240 Coins</Text>.
            </Text>
          </View>

          <View style={styles.actions}>
            <AppButton
              testID="guest-upgrade-submit"
              title="Create Free Account"
              fullWidth
              onPress={onUpgrade}
            />
            <AppButton
              testID="guest-upgrade-dismiss"
              title="Keep Playing Offline"
              variant="secondary"
              fullWidth
              onPress={onDismiss}
            />
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
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bonusText: {
    fontSize: 10.5,
    fontFamily: fonts.mono.semibold,
    color: '#B45309',
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
    width: '100%',
    gap: 8,
    paddingTop: 4,
  },
});
