import React, { ElementRef, forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { radius } from '../../design-system/radius';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { Pressy } from './Pressy';

export interface AppInputProps extends TextInputProps {
  label?: string;
  labelRight?: React.ReactNode;
  error?: string | null;
  hint?: string;
  leftIcon?: React.ReactNode;
  secureToggle?: boolean;
}

export const AppInput = forwardRef<ElementRef<typeof TextInput>, AppInputProps>(function AppInput(
  { label, labelRight, error, hint, leftIcon, secureToggle, style, onFocus, onBlur, ...rest },
  ref,
) {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const secure = secureToggle ? hidden : rest.secureTextEntry;
  return (
    <View style={{ gap: 6 }}>
      {label || labelRight ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {label ? <Text style={[type.smallStrong, { color: c.textSecondary }]}>{label}</Text> : <View />}
          {labelRight}
        </View>
      ) : null}
      <View
        style={[
          styles.box,
          { backgroundColor: c.bgCard, borderColor: error ? c.danger : focused ? c.accent : c.border },
        ]}
      >
        {leftIcon}
        <TextInput
          ref={ref}
          accessibilityLabel={label ?? rest.placeholder}
          placeholderTextColor={c.textSecondary + 'AA'}
          selectionColor={c.accent}
          {...rest}
          secureTextEntry={secure}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: c.text, fontFamily: fonts.body.medium }, style]}
        />
        {secureToggle ? (
          <Pressy
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            style={styles.togglePressy}
          >
            <Text style={[styles.toggleText, { color: c.textSecondary }]}>
              {hidden ? 'Show' : 'Hide'}
            </Text>
          </Pressy>
        ) : null}
      </View>
      {error ? <Text style={[type.small, { color: c.danger }]}>{error}</Text> : hint ? <Text style={[type.small, { color: c.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { minHeight: 50, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
  togglePressy: { paddingVertical: 6, paddingHorizontal: 4 },
  toggleText: { fontFamily: fonts.body.semibold, fontSize: 11.5 },
});
