import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressy } from '../../components/common/Pressy';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api/authApi';
import { friendlyMessage } from '../../services/api/errors';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { OTP_COOLDOWN_SEC, OTP_LENGTH, otpErrorInfo } from './authValidation';
import { emptyDigits, OtpInput } from './OtpInput';
import { ProtoButton, ProtoHeader, ProtoScreen } from './protoUi';
import { useCountdown } from './useCountdown';

import { fs } from '../../design-system/responsive';
/** sa****@example.com: keeps the first two characters of the address. */
export const maskEmail = (e: string) => {
  const [local, domain] = e.split('@');
  if (!domain) return e;
  return `${local.slice(0, 2)}****@${domain}`;
};

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export const OtpVerificationScreen: React.FC<RootScreenProps<'otp_verification'>> = ({ route }) => {
  const { email, purpose } = route.params;
  const c = useTheme();
  const { nav, resetTo, back } = useAppNav();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const { left, start } = useCountdown(OTP_COOLDOWN_SEC); // a code was just sent when we arrive
  const lastTried = useRef('');

  useEffect(() => {
    if (purpose === 'reset') nav.replace('forgot_password'); // reset codes are collected by the Forgot Password flow
  }, [purpose, nav]);

  const code = digits.join('');

  const verify = useCallback(
    async (value: string) => {
      if (busy || locked) return;
      lastTried.current = value;
      setBusy(true);
      setError(null);
      try {
        await authApi.verifyEmail(email, value);
        await refreshUser();
        toast.success('Email verified', 'Welcome!');
        resetTo('Main');
      } catch (e) {
        const info = otpErrorInfo(e);
        if (info.code === 'OTP_LOCKED') {
          setLocked(true);
          setError('Too many wrong tries. Get a new code.');
        } else if (info.code === 'INVALID_OTP') {
          setError(
            info.attemptsLeft !== undefined
              ? `Wrong code. ${info.attemptsLeft} ${info.attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`
              : 'That code is wrong or has expired.',
          );
        } else {
          setError(friendlyMessage(e));
        }
        setShakeKey((k) => k + 1);
        setDigits(emptyDigits());
        setBusy(false);
      }
    },
    [busy, locked, email, refreshUser, resetTo],
  );

  // Auto-submit as soon as the sixth digit is in.
  useEffect(() => {
    if (purpose === 'verify' && code.length === OTP_LENGTH && !busy && !locked && lastTried.current !== code) void verify(code);
  }, [code, purpose, busy, locked, verify]);

  const resend = async () => {
    if (left > 0 || resending) return;
    if (!signedIn) {
      setError('Sign in first, then ask for a new code from your profile.');
      return;
    }
    setResending(true);
    setError(null);
    try {
      const r = await authApi.resendVerification();
      start(r.retryAfterSec || OTP_COOLDOWN_SEC);
      setLocked(false);
      lastTried.current = '';
      setDigits(emptyDigits());
      toast.success('Code sent', 'We sent a new 6-digit code.');
    } catch (e) {
      const info = otpErrorInfo(e);
      if (info.code === 'OTP_COOLDOWN') start(info.retryAfterSec ?? OTP_COOLDOWN_SEC);
      else if (info.code === 'ALREADY_VERIFIED') {
        await refreshUser();
        toast.info('Already verified', 'Your email is already verified.');
        resetTo('Main');
        return;
      }
      setError(friendlyMessage(e));
    } finally {
      setResending(false);
    }
  };

  if (purpose === 'reset') return null;

  return (
    <ProtoScreen testID="otp-screen">
      <ProtoHeader title="Verify Email" onBack={back} />
      <View style={styles.body}>
        <View>
          <Text style={[styles.title, { color: c.text }]}>Enter your code</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>
            We sent a 6-digit code to <Text style={{ color: c.text, fontFamily: fonts.body.semibold }}>{maskEmail(email)}</Text>
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <OtpInput digits={digits} onChange={(d) => { setDigits(d); setError(null); }} disabled={busy || locked} hasError={!!error} shakeKey={shakeKey} autoFocus />
          {error ? (
            <Text testID="otp-error" accessibilityRole="alert" style={[styles.error, { color: c.danger }]}>
              {error}
            </Text>
          ) : null}
        </View>

        <View style={styles.resendRow}>
          <Text style={[styles.resendLabel, { color: c.textSecondary }]}>{left > 0 ? 'Resend in' : 'Didn’t get a code?'}</Text>
          {left > 0 ? (
            <Text testID="otp-countdown" style={[styles.resendValue, { color: c.accent, fontFamily: fonts.mono.semibold }]}>
              {mmss(left)}
            </Text>
          ) : (
            <Pressy testID="otp-resend" accessibilityLabel="Resend code" disabled={resending} onPress={() => void resend()} hitSlop={14}>
              <Text style={[styles.resendValue, { color: c.accent }]}>
                {resending ? 'Sending...' : locked ? 'Get a new code' : 'Resend Code'}
              </Text>
            </Pressy>
          )}
        </View>

        <View style={styles.footer}>
          <ProtoButton
            testID="otp-submit"
            title="Verify"
            loading={busy}
            disabled={code.length < OTP_LENGTH || locked}
            onPress={() => void verify(code)}
          />
        </View>
      </View>
    </ProtoScreen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 16 },
  title: { fontFamily: fonts.body.semibold, fontSize: fs(17), lineHeight: Math.round(fs(17) * 1.3), letterSpacing: -0.3 },
  sub: { fontFamily: fonts.body.regular, fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.3), marginTop: 6 },
  error: { fontFamily: fonts.body.regular, fontSize: fs(12), lineHeight: Math.round(fs(12) * 1.3), textAlign: 'center' },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, minHeight: 28 },
  resendLabel: { fontFamily: fonts.body.regular, fontSize: fs(13) },
  resendValue: { fontFamily: fonts.body.semibold, fontSize: fs(13) },
  footer: { marginTop: 'auto', paddingTop: 8 },
});
