import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { CoinIcon, ProtoButton, WARNING, WARNING_BORDER, WARNING_SOFT } from '../../screens/auth/protoUi';

import { fs, ms } from '../../design-system/responsive';
export interface GuestUpgradeModalProps {
  open: boolean;
  onUpgrade: () => void;
  onDismiss: () => void;
  /** The guest's real wallet balance. The "keep your N Coins" clause is only shown when it is above zero. */
  coins?: number;
  /**
   * Coins granted for linking an account. The backend has no such grant today, so the "+N Bonus Coins" badge is
   * only rendered when a caller passes a positive number.
   */
  bonusCoins?: number;
}

/** Account-upgrade prompt shown to guests who reach Ranked 1v1 / cloud sync (UI Kit view 53). */
export const GuestUpgradeModal: React.FC<GuestUpgradeModalProps> = ({ open, onUpgrade, onDismiss, coins = 0, bonusCoins = 0 }) => {
  const c = useTheme();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.scrim} testID="guest-upgrade-modal">
        <View style={[styles.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          {bonusCoins > 0 ? (
            <View style={styles.bonusBadge}>
              <CoinIcon size={ms(15)} />
              <Text style={styles.bonusText}>+{bonusCoins} Bonus Coins</Text>
            </View>
          ) : null}

          <View style={styles.copy}>
            <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>Save Your Progress</Text>
            <Text style={[styles.desc, { color: c.textSecondary }]}>
              Guest progress stays on this device. Create an account to play ranked matches
              {coins > 0 ? (
                <>
                  {' '}and keep your <Text style={{ fontFamily: fonts.body.semibold, color: c.text }}>{coins.toLocaleString()} Coins</Text>
                </>
              ) : null}
              .
            </Text>
          </View>

          <View style={styles.actions}>
            <ProtoButton testID="guest-upgrade-submit" title="Create Account" height={41} onPress={onUpgrade} />
            <ProtoButton testID="guest-upgrade-dismiss" title="Keep Playing Offline" variant="secondary" height={40} fontSize={fs(12.5)} onPress={onDismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(20, 21, 24, 0.36)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: ms(340),
    borderRadius: 20,
    borderWidth: 1,
    padding: ms(22),
    alignItems: 'center',
    gap: 14,
    shadowColor: '#141518',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: WARNING_SOFT,
    borderWidth: 1,
    borderColor: WARNING_BORDER,
  },
  bonusText: { fontFamily: fonts.body.semibold, fontSize: fs(11.5), color: WARNING },
  copy: { alignItems: 'center', gap: 4 },
  title: { fontFamily: fonts.body.semibold, fontSize: fs(17), lineHeight: Math.round(fs(17) * 1.3), textAlign: 'center' },
  desc: { fontFamily: fonts.body.regular, fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.3), textAlign: 'center' },
  actions: { width: '100%', gap: 8, paddingTop: 4 },
});
