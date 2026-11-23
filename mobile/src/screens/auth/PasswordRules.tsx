import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { PASSWORD_RULES } from './authValidation';
import { MUTED, RulePill } from './protoUi';

import { fs, ms } from '../../design-system/responsive';
/**
 * Live password-policy chips (rules mirror backend/src/validators/common.ts).
 * `card` = the bordered "Password Rules" box of the registration view; without it only the chips render (reset view).
 */
export const PasswordRules: React.FC<{ value: string; card?: boolean }> = ({ value, card = false }) => {
  const c = useTheme();
  const pills = (size: number) => (
    <View style={styles.pillsRow}>
      {PASSWORD_RULES.map((r) => (
        <RulePill key={r.id} label={r.label} ok={r.test(value)} size={size} />
      ))}
    </View>
  );

  if (!card) {
    return (
      <View testID="password-rules" style={styles.bare}>
        {pills(fs(10.5))}
      </View>
    );
  }
  return (
    <View testID="password-rules" style={[styles.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      <Text style={[styles.heading, { color: MUTED }]}>PASSWORD RULES</Text>
      {pills(fs(10.5))}
    </View>
  );
};

const styles = StyleSheet.create({
  bare: { marginTop: 8 },
  card: { padding: ms(12), borderRadius: 12, borderWidth: 1, gap: 8 },
  heading: { fontFamily: fonts.body.semibold, fontSize: fs(11), lineHeight: Math.round(fs(11) * 1.3), letterSpacing: 0.5 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
