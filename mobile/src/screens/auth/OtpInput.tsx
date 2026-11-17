import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TextInput, TextInputKeyPressEvent, View } from 'react-native';
import { radius } from '../../design-system/radius';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { OTP_LENGTH } from './authValidation';

/** Six single-digit boxes: auto-advance, backspace to previous, paste / autofill of a full code. */
export const OtpInput: React.FC<{
  digits: string[];
  onChange: (digits: string[]) => void;
  disabled?: boolean;
  hasError?: boolean;
  /** Increment to play the shake animation. */
  shakeKey?: number;
  autoFocus?: boolean;
  testIDPrefix?: string;
}> = ({ digits, onChange, disabled, hasError, shakeKey = 0, autoFocus, testIDPrefix = 'otp' }) => {
  const c = useTheme();
  const refs = useRef<Array<React.ElementRef<typeof TextInput> | null>>([]);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!shakeKey) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: false }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: false }),
      Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: false }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: false }),
    ]).start();
  }, [shakeKey, shake]);

  const focus = (i: number) => refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))]?.focus();

  const handleChange = (idx: number, text: string) => {
    const clean = text.replace(/\D/g, '');
    const next = [...digits];
    if (clean.length === 0) {
      next[idx] = '';
      onChange(next);
      return;
    }
    if (clean.length === 1) {
      next[idx] = clean;
      onChange(next);
      if (idx < OTP_LENGTH - 1) focus(idx + 1);
      return;
    }
    if (clean.length === 2 && digits[idx]) {
      // typed over a filled box: keep the new character
      next[idx] = clean[1];
      onChange(next);
      if (idx < OTP_LENGTH - 1) focus(idx + 1);
      return;
    }
    // paste / autofill of several digits
    const start = clean.length >= OTP_LENGTH ? 0 : idx;
    const chars = clean.slice(0, OTP_LENGTH - start).split('');
    chars.forEach((ch, k) => (next[start + k] = ch));
    onChange(next);
    focus(start + chars.length);
  };

  const handleKey = (idx: number, e: TextInputKeyPressEvent) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[idx] && idx > 0) {
      const next = [...digits];
      next[idx - 1] = '';
      onChange(next);
      focus(idx - 1);
    }
  };

  return (
    <Animated.View style={[styles.row, { transform: [{ translateX: shake }] }]}>
      {digits.map((d, i) => (
        <View key={i} style={{ flex: 1 }}>
          <TextInput
            ref={(r) => {
              refs.current[i] = r;
            }}
            testID={`${testIDPrefix}-${i}`}
            accessibilityLabel={`Verification code digit ${i + 1}`}
            value={d}
            editable={!disabled}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={OTP_LENGTH}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus={autoFocus && i === 0}
            selectTextOnFocus
            caretHidden
            onChangeText={(t) => handleChange(i, t)}
            onKeyPress={(e) => handleKey(i, e)}
            style={[
              styles.box,
              {
                backgroundColor: c.bgCard,
                color: c.text,
                borderColor: hasError ? c.danger : d ? c.accent : c.border,
                opacity: disabled ? 0.5 : 1,
                fontFamily: fonts.mono.bold,
              },
            ]}
          />
        </View>
      ))}
    </Animated.View>
  );
};

export const emptyDigits = (): string[] => Array.from({ length: OTP_LENGTH }, () => '');

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  box: { height: 54, borderRadius: radius.md, borderWidth: 1, textAlign: 'center', fontSize: 20, padding: 0 },
});
