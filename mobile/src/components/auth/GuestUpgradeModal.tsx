import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Popup } from '../common/Popup';
import { fonts } from '../../design-system/typography';
import { CoinIcon, WARNING, WARNING_BORDER, WARNING_SOFT } from '../../screens/auth/protoUi';

import { ms } from '../../design-system/responsive';
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

/** Account-upgrade prompt shown to guests who reach Ranked 1v1 / cloud sync (UI Kit view 53). Drawn by the shared Popup. */
export const GuestUpgradeModal: React.FC<GuestUpgradeModalProps> = ({ open, onUpgrade, onDismiss, coins = 0, bonusCoins = 0 }) => {
  return (
    <Popup
      open={open}
      title="Save Your Progress"
      onDismiss={onDismiss}
      testID="guest-upgrade-modal"
      badge={
        bonusCoins > 0 ? (
          <View style={styles.bonusBadge}>
            <CoinIcon size={ms(15)} />
            <Text style={styles.bonusText}>+{bonusCoins} Bonus Coins</Text>
          </View>
        ) : undefined
      }
      message={`Guest progress stays on this device. Create an account to play ranked matches${coins > 0 ? ` and keep your ${coins.toLocaleString()} Coins` : ''}.`}
      actions={[
        { testID: 'guest-upgrade-submit', label: 'Create Account', variant: 'primary', onPress: onUpgrade },
        { testID: 'guest-upgrade-dismiss', label: 'Keep Playing Offline', variant: 'secondary', onPress: onDismiss },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  bonusBadge: { flexDirection: 'row', alignItems: 'center', gap: ms(6), alignSelf: 'center', paddingHorizontal: ms(10), paddingVertical: ms(4), borderRadius: 999, borderWidth: 1, borderColor: WARNING_BORDER, backgroundColor: WARNING_SOFT },
  bonusText: { fontSize: ms(12), fontFamily: fonts.body.semibold, color: WARNING },
});
