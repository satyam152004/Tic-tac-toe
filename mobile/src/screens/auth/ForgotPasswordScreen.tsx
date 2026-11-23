import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api/authApi';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { toast } from '../../store/toastStore';
import { emailError, OTP_COOLDOWN_SEC, OTP_LENGTH, otpErrorInfo, passwordValid } from './authValidation';
import { emptyDigits } from './OtpInput';
import { PasswordRules } from './PasswordRules';
import { MUTED, ProtoButton, ProtoHeader, ProtoInput, ProtoScreen } from './protoUi';
import { useCountdown } from './useCountdown';

import { fs } from '../../design-system/responsive';
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export const ForgotPasswordScreen: React.FC<RootScreenProps<'forgot_password'>> = () => {
  const c = useTheme();
  const { resetTo, back } = useAppNav();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ code?: string; password?: string; form?: string }>({});
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const { left, start } = useCountdown(0);

  const target = email.trim().toLowerCase();

  /** Request (or re-request) the code. The server answers success whether or not the account exists. */
  const sendCode = async (isResend = false) => {
    if (busy) return;
    const err = emailError(email);
    setEmailErr(err);
    if (err) return;
    setBusy(true);
    setErrors({});
    try {
      await authApi.forgotPassword(target);
      start(OTP_COOLDOWN_SEC);
      setLocked(false);
      setDigits(emptyDigits());
      setStep('reset');
      if (isResend) toast.success('Code sent', 'If that account exists, we sent a new code.');
    } catch (e) {
      const info = otpErrorInfo(e);
      if (info.code === 'OTP_COOLDOWN') {
        start(info.retryAfterSec ?? OTP_COOLDOWN_SEC);
        setStep('reset');
      }
      const msg = friendlyMessage(e);
      if (step === 'email') setEmailErr(msg);
      else setErrors({ form: msg });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (busy || locked) return;
    const code = digits.join('');
    const next: typeof errors = {};
    if (code.length < OTP_LENGTH) next.code = 'Enter the 6-digit code from your email';
    if (!passwordValid(password)) next.password = "Password doesn't meet the rules below";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await authApi.resetPassword({ email: target, code, newPassword: password });
      toast.success('Password updated', 'Sign in with your new password');
      resetTo('login');
    } catch (e) {
      const info = otpErrorInfo(e);
      if (info.code === 'OTP_LOCKED') {
        setLocked(true);
        setErrors({ code: 'Too many wrong tries. Get a new code.' });
      } else if (info.code === 'INVALID_OTP') {
        setErrors({
          code:
            info.attemptsLeft !== undefined
              ? `Wrong code. ${info.attemptsLeft} ${info.attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`
              : 'That code is wrong or has expired.',
        });
        setDigits(emptyDigits());
      } else if (toApiError(e).code === 'VALIDATION_ERROR') {
        setErrors({ password: "That password isn't allowed. Check the rules below." });
      } else {
        setErrors({ form: friendlyMessage(e) });
      }
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'email') {
    return (
      <ProtoScreen testID="forgot-screen">
        <ProtoHeader title="Reset Password" onBack={back} />
        <View style={styles.body}>
          <Text style={[styles.note, { color: c.textSecondary }]}>
            Enter your email and we'll send you a 6-digit code.
          </Text>
          <ProtoInput
            testID="forgot-email"
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setEmailErr(null);
            }}
            error={emailErr}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
            onSubmitEditing={() => void sendCode()}
          />
          <View style={styles.footer}>
            <ProtoButton testID="forgot-send" title="Send Code" loading={busy} onPress={() => void sendCode()} />
          </View>
        </View>
      </ProtoScreen>
    );
  }

  return (
    <ProtoScreen testID="forgot-reset-screen">
      <ProtoHeader title="Reset Password" onBack={() => setStep('email')} />
      <View style={styles.body}>
        <View>
          <ProtoInput
            label="Email"
            value={target}
            editable={false}
            right={<Text style={[styles.badge, { color: c.accent }]}>Code Sent</Text>}
          />
          <Text testID="forgot-neutral" style={[styles.neutral, { color: MUTED }]}>
            If {target} has an account, we sent it a 6-digit code.
          </Text>
        </View>

        {/* One field for the 6-digit code (paste / SMS-style autofill friendly). Test id kept from the box-per-digit era. */}
        <ProtoInput
          testID="reset-otp-0"
          label="6-Digit Code"
          value={digits.join('')}
          onChangeText={(t) => {
            const clean = t.replace(/\D/g, '').slice(0, OTP_LENGTH);
            setDigits(Array.from({ length: OTP_LENGTH }, (_, i) => clean[i] ?? ''));
            setErrors((e) => ({ ...e, code: undefined }));
          }}
          editable={!busy && !locked}
          error={errors.code}
          placeholder="000000"
          mono
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={OTP_LENGTH + 4}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
        />

        <View>
          <ProtoInput
            testID="reset-password"
            label="New Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setErrors((e) => ({ ...e, password: undefined }));
            }}
            error={errors.password}
            secureToggle
            placeholder="New password"
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={() => void reset()}
          />
          <PasswordRules value={password} />
        </View>

        {errors.form ? (
          <Text testID="reset-error" accessibilityRole="alert" style={[styles.error, { color: c.danger }]}>
            {errors.form}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <ProtoButton testID="reset-submit" title="Update Password" loading={busy} disabled={locked} onPress={() => void reset()} />
          <View style={styles.resendRow}>
            {left > 0 ? (
              <Text testID="reset-countdown" style={[styles.resendText, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>
                Resend code in {mmss(left)}
              </Text>
            ) : (
              <Pressy testID="reset-resend" accessibilityLabel="Resend code" disabled={busy} onPress={() => void sendCode(true)} hitSlop={12}>
                <Text style={[styles.resendText, { color: c.accent, fontFamily: fonts.body.semibold }]}>
                  {locked ? 'Get a new code' : 'Resend code'}
                </Text>
              </Pressy>
            )}
          </View>
        </View>
      </View>
    </ProtoScreen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14 },
  note: { fontFamily: fonts.body.regular, fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.3) },
  badge: { fontFamily: fonts.body.semibold, fontSize: fs(12) },
  neutral: { fontFamily: fonts.body.regular, fontSize: fs(11.5), lineHeight: Math.round(fs(11.5) * 1.3), marginTop: 4 },
  error: { fontFamily: fonts.body.regular, fontSize: fs(12), lineHeight: Math.round(fs(12) * 1.3) },
  footer: { marginTop: 'auto', paddingTop: 8, gap: 8 },
  resendRow: { alignItems: 'center', minHeight: 28, justifyContent: 'center' },
  resendText: { fontSize: fs(12.5) },
});
