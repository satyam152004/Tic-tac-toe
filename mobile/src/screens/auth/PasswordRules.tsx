import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../design-system/typography';
import { withAlpha } from '../../design-system/colors';
import { useTheme } from '../../hooks/useTheme';
import { PASSWORD_RULES } from './authValidation';

/** Live password-policy hints in a clean pill-card matching prototype View #7 and View #9. */
export const PasswordRules: React.FC<{ value: string }> = ({ value }) => {
  const c = useTheme();

  return (
    <View
      testID="password-rules">
      <View style={styles.pillsRow}>
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(value);
          return (
            <View
              key={r.id}
              accessibilityLabel={`${r.label}: ${ok ? 'met' : 'not met'}`}
              style={[
                styles.pill,
                ok
                  ? { backgroundColor: withAlpha(c.success, 0.12), borderColor: withAlpha(c.success, 0.3) }
                  : { backgroundColor: c.bgSecondary, borderColor: c.border },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: ok ? c.success : c.textSecondary },
                ]}
              >
                {ok ? `✓ ${r.label}` : r.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  heading: {
    fontFamily: fonts.body.semibold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: fonts.body.semibold,
    fontSize: 10.5,
  },
});
