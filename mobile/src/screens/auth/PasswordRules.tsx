import React from 'react';
import { Text, View } from 'react-native';
import { Check, Circle } from 'lucide-react-native';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { PASSWORD_RULES } from './authValidation';

/** Live password-policy hints (same rules as the server). */
export const PasswordRules: React.FC<{ value: string }> = ({ value }) => {
  const c = useTheme();
  return (
    <View style={{ gap: 4 }} testID="password-rules">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLabel={`${r.label}: ${ok ? 'met' : 'not met'}`}>
            {ok ? <Check size={13} color={c.success} /> : <Circle size={13} color={c.textSecondary} />}
            <Text style={[type.small, { color: ok ? c.success : c.textSecondary }]}>{r.label}</Text>
          </View>
        );
      })}
    </View>
  );
};
