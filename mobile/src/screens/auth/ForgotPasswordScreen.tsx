import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../services/api/authApi';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { toast } from '../../store/toastStore';
import { emailError, OTP_COOLDOWN_SEC, OTP_LENGTH, otpErrorInfo, passwordValid } from './authValidation';
import { emptyDigits, OtpInput } from './OtpInput';
import { PasswordRules } from './PasswordRules';
import { useCountdown } from './useCountdown';

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
  const [errors, setErrors] = useState<{ code?: string; password?: string; confirm?: string; form?: string }>({});
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
      if (isResend) toast.success('Code sent', 'If that account exists, a new code is on its way');
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
    if (!passwordValid(password)) next.password = 'Password does not meet the requirements below';
    if (confirm !== password) next.confirm = 'Passwords do not match';
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
        setErrors({ code: 'Too many wrong attempts. Request a new code to continue.' });
      } else if (info.code === 'INVALID_OTP') {
        setErrors({
          code:
            info.attemptsLeft !== undefined
              ? `Wrong code. ${info.attemptsLeft} ${info.attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`
              : 'That code is wrong or has expired.',
        });
        setDigits(emptyDigits());
      } else if (toApiError(e).code === 'VALIDATION_ERROR') {
        setErrors({ password: 'The server rejected that password. Check the requirements below.' });
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
      <Screen
        title="Reset Password"
        onBack={back}
        testID="forgot-screen"
        contentStyle={styles.screenContent}
      >
        <View style={styles.headerBlock}>
          <Text style={[styles.title, { color: c.text }]}>Reset Password</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>
            Enter your email address and we will send you a 6-digit recovery code.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <AppInput
            testID="forgot-email"
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setEmailErr(null);
            }}
            error={emailErr}
            placeholder="you@domain.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
            onSubmitEditing={() => void sendCode()}
          />
        </View>

        <View style={styles.actionBlock}>
          <AppButton
            testID="forgot-send"
            title="Send Reset Code"
            size="lg"
            fullWidth
            loading={busy}
            onPress={() => void sendCode()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Reset Password"
      onBack={() => setStep('email')}
      testID="forgot-reset-screen"
      contentStyle={styles.screenContent}
    >
      <View style={styles.headerBlock}>
        <Text style={[styles.title, { color: c.text }]}>Check Your Email</Text>
        <Text testID="forgot-neutral" style={[styles.sub, { color: c.textSecondary }]}>
          If an account exists for <Text style={{ color: c.text, fontFamily: fonts.body.semibold }}>{target}</Text>, we have sent a 6-digit code. Enter it below with your new password.
        </Text>
      </View>

      {/* 6-Digit Code Input matching View #9 */}
      <View style={styles.inputGroup}>
        {/* Email with Code Sent Badge */}
        <AppInput
          label="Email"
          value={target}
          editable={false}
          labelRight={
            <View style={[styles.badgePill, { backgroundColor: '#EFF4FF', borderColor: '#BFDBFE' }]}>
              <Text style={[styles.badgeText, { color: c.accent }]}>Code Sent</Text>
            </View>
          }
        />

        <View style={{ gap: 8 }}>
          <Text style={[type.smallStrong, { color: c.textSecondary }]}>6-Digit Code</Text>
          <OtpInput
            digits={digits}
            onChange={(d) => {
              setDigits(d);
              setErrors((e) => ({ ...e, code: undefined }));
            }}
            disabled={busy || locked}
            hasError={!!errors.code}
            shakeKey={shakeKey}
            autoFocus
            testIDPrefix="reset-otp"
          />
          {errors.code ? (
            <Text testID="reset-code-error" accessibilityRole="alert" style={[type.small, { color: c.danger, textAlign: 'center' }]}>
              {errors.code}
            </Text>
          ) : null}
        </View>

        <AppInput
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
        />

        {/* Password Rules Card matching View #9 */}
        <PasswordRules value={password} />

        <AppInput
          testID="reset-confirm"
          label="Confirm New Password"
          value={confirm}
          onChangeText={(t) => {
            setConfirm(t);
            setErrors((e) => ({ ...e, confirm: undefined }));
          }}
          error={errors.confirm}
          secureToggle
          placeholder="Confirm new password"
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </View>

      {errors.form ? (
        <Text testID="reset-error" accessibilityRole="alert" style={[type.small, { color: c.danger }]}>
          {errors.form}
        </Text>
      ) : null}

      {/* Primary Action Button matching View #9: Update Password */}
      <View style={styles.actionBlock}>
        <AppButton
          testID="reset-submit"
          title="Update Password"
          size="lg"
          fullWidth
          loading={busy}
          disabled={locked}
          onPress={() => void reset()}
        />

        <View style={{ alignItems: 'center', marginTop: 12 }}>
          {left > 0 ? (
            <Text testID="reset-countdown" style={[type.small, { color: c.textSecondary, fontFamily: fonts.mono.medium }]}>
              Resend code in {mmss(left)}
            </Text>
          ) : (
            <Pressy
              testID="reset-resend"
              accessibilityLabel="Resend code"
              disabled={busy}
              onPress={() => void sendCode(true)}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={[type.smallStrong, { color: c.accent }]}>
                {locked ? 'Request a new code' : 'Resend code'}
              </Text>
            </Pressy>
          )}
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    gap: 16,
  },
  headerBlock: {
    gap: 2,
    marginTop: 2,
  },
  title: {
    fontFamily: fonts.body.semibold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  sub: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  inputGroup: {
    gap: 14,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fonts.body.semibold,
    fontSize: 10.5,
  },
  actionBlock: {
    marginTop: 'auto',
    paddingTop: 16,
  },
});
