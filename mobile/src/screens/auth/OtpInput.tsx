import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput, TextInputKeyPressEvent, View } from 'react-native';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { OTP_LENGTH } from './authValidation';
import { ACCENT_SOFT, BORDER_STRONG, MUTED } from './protoUi';

/**
 * Six single-digit boxes (48px, radius 10, 17px digits): auto-advance, backspace to previous, paste / autofill of a
 * full code. The focused box gets the cobalt highlight from the prototype, filled boxes a strong border.
 */
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
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

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
      {digits.map((d, i) => {
        const active = focusedIdx === i && !hasError;
        const box = hasError
          ? { backgroundColor: c.bgCard, borderColor: c.danger, borderWidth: 1, color: c.text }
          : active
            ? { backgroundColor: ACCENT_SOFT, borderColor: c.accent, borderWidth: 1.5, color: c.accent }
            : d
              ? { backgroundColor: c.bgCard, borderColor: BORDER_STRONG, borderWidth: 1, color: c.text }
              : { backgroundColor: c.bgCard, borderColor: c.border, borderWidth: 1, color: MUTED };
        return (
          <View key={i} style={{ flex: 1 }}>
            <TextInput
              ref={(r) => {
                refs.current[i] = r;
              }}
              testID={`${testIDPrefix}-${i}`}
              accessibilityLabel={`Verification code digit ${i + 1}`}
              value={d}
              placeholder="_"
              placeholderTextColor={active ? c.accent : MUTED}
              editable={!disabled}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={OTP_LENGTH}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoFocus={autoFocus && i === 0}
              selectTextOnFocus
              caretHidden
              onFocus={() => setFocusedIdx(i)}
              onBlur={() => setFocusedIdx((f) => (f === i ? null : f))}
              onChangeText={(t) => handleChange(i, t)}
              onKeyPress={(e) => handleKey(i, e)}
              style={[styles.box, box, { opacity: disabled ? 0.5 : 1, fontFamily: fonts.mono.semibold }]}
            />
          </View>
        );
      })}
    </Animated.View>
  );
};

export const emptyDigits = (): string[] => Array.from({ length: OTP_LENGTH }, () => '');

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  box: { height: 48, borderRadius: 10, textAlign: 'center', fontSize: 17, padding: 0 },
});
