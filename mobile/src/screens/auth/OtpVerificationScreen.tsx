import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { type, fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api/authApi';
import { friendlyMessage } from '../../services/api/errors';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { OTP_COOLDOWN_SEC, OTP_LENGTH, otpErrorInfo } from './authValidation';
import { emptyDigits, OtpInput } from './OtpInput';
import { useCountdown } from './useCountdown';

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
        toast.success('Email verified', 'Welcome to the Arena');
        resetTo('Main');
      } catch (e) {
        const info = otpErrorInfo(e);
        if (info.code === 'OTP_LOCKED') {
          setLocked(true);
          setError('Too many wrong attempts. Request a new code to continue.');
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
      setError('Please sign in first, then request a new code from your profile.');
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
      toast.success('Code sent', 'A fresh 6-digit code is on its way');
    } catch (e) {
      const info = otpErrorInfo(e);
      if (info.code === 'OTP_COOLDOWN') start(info.retryAfterSec ?? OTP_COOLDOWN_SEC);
      else if (info.code === 'ALREADY_VERIFIED') {
        await refreshUser();
        toast.info('Already verified', 'Your email is already confirmed');
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
    <Screen
      title="OTP Verification"
      onBack={back}
      testID="otp-screen"
      footer={
        <>
          <AppButton
            testID="otp-submit"
            title="Verify & Continue"
            fullWidth
            loading={busy}
            disabled={code.length < OTP_LENGTH || locked}
            onPress={() => void verify(code)}
          />
          <AppButton testID="otp-skip" title="Skip for now" variant="ghost" fullWidth onPress={() => resetTo('Main')} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 16 }}>
        <Text style={[type.headline, { color: c.text }]}>Enter Verification Code</Text>
        <Text style={[type.small, { color: c.textSecondary, textAlign: 'center' }]}>
          We sent a 6-digit security code to <Text style={{ color: c.text, fontFamily: fonts.body.semibold }}>{email}</Text>.
        </Text>
      </View>

      <View style={{ paddingTop: 12, gap: 10 }}>
        <OtpInput digits={digits} onChange={(d) => { setDigits(d); setError(null); }} disabled={busy || locked} hasError={!!error} shakeKey={shakeKey} autoFocus />
        {error ? (
          <Text testID="otp-error" accessibilityRole="alert" style={[type.small, { color: c.danger, textAlign: 'center' }]}>
            {error}
          </Text>
        ) : null}
      </View>

      <View style={{ alignItems: 'center' }}>
        {left > 0 ? (
          <Text testID="otp-countdown" style={[type.small, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>
            Resend code in {mmss(left)}
          </Text>
        ) : (
          <Pressy testID="otp-resend" accessibilityLabel="Resend OTP code" disabled={resending} onPress={() => void resend()} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={[type.smallStrong, { color: c.accent }]}>{resending ? 'Sending...' : locked ? 'Request a new code' : 'Resend OTP Code'}</Text>
          </Pressy>
        )}
      </View>
    </Screen>
  );
};
