import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { signInWithApple, signInWithGoogle } from '../../services/socialAuth';
import { useAuthStore, useIsGuest } from '../../store/authStore';
import { emailError, passwordValid, usernameError } from './authValidation';
import { PasswordRules } from './PasswordRules';

type Field = 'username' | 'email' | 'password' | 'confirm' | 'terms';

/* ── Google Multi-Color Brand SVG ── */
const GoogleIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </Svg>
);

/* ── Apple Brand SVG ── */
const AppleIcon: React.FC<{ size?: number; color: string }> = ({ size = 16, color }) => (
  <Svg width={size} height={size} viewBox="0 0 170 170" fill={color}>
    <Path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.77-11.65-14.19-5.77-9.15-10.34-19.46-13.72-30.93-3.38-11.48-5.07-22.42-5.07-32.81 0-14.04 3.46-25.96 10.37-35.77 6.92-9.8 15.7-14.86 26.35-15.17 4.36 0 9.29 1.15 14.8 3.44 5.51 2.29 9.38 3.51 11.61 3.66 1.83-.24 5.75-1.52 11.75-3.86 6-2.33 11.03-3.32 15.09-2.96 11.54.91 20.89 5.37 28.05 13.38-10.02 6.09-14.91 14.73-14.67 25.93.24 8.79 3.57 16.14 10 22.06 6.43 5.91 13.97 9.26 22.61 10.05-2.17 6.54-4.89 13.3-8.16 20.28zM119.22 33.7c0-7.39 2.6-14.17 7.8-20.35 5.2-6.18 11.65-10.06 19.35-11.65.24 1.48.36 2.89.36 4.23 0 7.39-2.73 14.3-8.2 20.73-5.46 6.42-12.06 10.22-19.8 11.41-.12-1.48-.19-2.94-.19-4.37z" />
  </Svg>
);

export const RegistrationScreen: React.FC<RootScreenProps<'registration'>> = () => {
  const c = useTheme();
  const { nav, resetTo, back } = useAppNav();
  const { height: screenH } = useWindowDimensions();
  const isGuest = useIsGuest();
  const register = useAuthStore((s) => s.register);
  const upgradeGuest = useAuthStore((s) => s.upgradeGuest);

  const isTall = screenH >= 800;
  const socialBtnHeight = isTall ? 44 : 40;

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});
  const [busyAction, setBusyAction] = useState<'submit' | 'google' | 'apple' | null>(null);
  const busy = busyAction !== null;

  const clear = (f: Field) => setErrors((e) => ({ ...e, [f]: undefined, form: undefined }));

  const submit = async () => {
    if (busy) return;
    const next: typeof errors = {};
    const u = usernameError(username);
    if (u) next.username = u;
    const em = emailError(email);
    if (em) next.email = em;
    if (!passwordValid(password)) next.password = 'Password does not meet the requirements below';
    if (confirm !== password) next.confirm = 'Passwords do not match';
    if (!terms) next.terms = 'Please accept the Terms of Service to continue';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusyAction('submit');
    const input = { email: email.trim().toLowerCase(), password, username: username.trim() };
    try {
      if (isGuest) await upgradeGuest(input);
      else await register(input);
      nav.replace('otp_verification', { email: input.email, purpose: 'verify' });
    } catch (e) {
      const err = toApiError(e);
      if (err.code === 'EMAIL_TAKEN') setErrors({ email: 'That email is already registered. Try signing in instead.' });
      else if (err.code === 'USERNAME_TAKEN') setErrors({ username: 'That username is taken. Pick another one.' });
      else if (err.code === 'ALREADY_REGISTERED') setErrors({ form: 'This account is already registered. Please sign in.' });
      else setErrors({ form: friendlyMessage(err) });
      setBusyAction(null);
    }
  };

  const social = async (action: 'google' | 'apple', fn: () => Promise<void>) => {
    if (busy) return;
    setBusyAction(action);
    setErrors({});
    try {
      await fn();
      resetTo('Main');
    } catch (e) {
      if (!(e instanceof Error && e.message === 'CANCELLED')) {
        setErrors({ form: friendlyMessage(e) });
      }
      setBusyAction(null);
    }
  };

  return (
    <Screen
      title="Create Account"
      onBack={back}
      testID="registration-screen"
      contentStyle={styles.screenContent}
    >
      {/* Guest Progress Notice */}
      {isGuest ? (
        <AppCard padding="sm">
          <Text style={[type.small, { color: c.textSecondary }]}>
            Your guest progress, coins and stats will be kept on your new account.
          </Text>
        </AppCard>
      ) : null}

      {/* Input Fields matching View #7 */}
      <View style={styles.inputGroup}>
        <AppInput
          testID="register-username"
          label="Username"
          value={username}
          onChangeText={(t) => {
            setUsername(t);
            clear('username');
          }}
          error={errors.username}
          hint="3-20 characters: letters, numbers, underscore"
          placeholder="@username"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
        <AppInput
          testID="register-email"
          label="Email"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            clear('email');
          }}
          error={errors.email}
          placeholder="you@domain.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoCorrect={false}
        />
        <AppInput
          testID="register-password"
          label="Password"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            clear('password');
          }}
          error={errors.password}
          secureToggle
          placeholder="Create a password"
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        {/* Password Rules Card matching View #7 */}
        <PasswordRules value={password} />

        <AppInput
          testID="register-confirm"
          label="Confirm Password"
          value={confirm}
          onChangeText={(t) => {
            setConfirm(t);
            clear('confirm');
          }}
          error={errors.confirm}
          secureToggle
          placeholder="Repeat your password"
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        {/* Terms of Service Checkbox */}
        <View style={{ gap: 4 }}>
          <Pressy
            testID="register-terms"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: terms }}
            accessibilityLabel="I agree to the Terms of Service and Fair Play Policy"
            onPress={() => {
              setTerms((t) => !t);
              clear('terms');
            }}
            style={styles.termsRow}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: terms ? c.accent : c.border,
                  backgroundColor: terms ? c.accent : 'transparent',
                },
              ]}
            >
              {terms ? <Check size={14} color="#FFFFFF" /> : null}
            </View>
            <Text style={[styles.termsText, { color: c.textSecondary }]}>
              I agree to the Terms of Service and Fair Play Policy
            </Text>
          </Pressy>
          {errors.terms ? (
            <Text style={[type.small, { color: c.danger }]}>{errors.terms}</Text>
          ) : null}
        </View>
      </View>

      {/* Form Error Banner */}
      {errors.form ? (
        <Text testID="register-error" accessibilityRole="alert" style={[type.small, { color: c.danger }]}>
          {errors.form}
        </Text>
      ) : null}

      {/* Primary Submit Button */}
      <AppButton
        testID="register-submit"
        title={isGuest ? 'Create Account & Keep Progress' : 'Create Account'}
        size="lg"
        fullWidth
        loading={busyAction === 'submit'}
        onPress={submit}
      />

      {/* Social Buttons with authentic SVGs matching Welcome page */}
      <View style={styles.socialRow}>
        <Pressy
          testID="register-google"
          accessibilityLabel="Google"
          disabled={busy}
          style={[
            styles.socialBtn,
            {
              height: socialBtnHeight,
              backgroundColor: c.bgCard,
              borderColor: c.border,
            },
          ]}
          onPress={() => void social('google', signInWithGoogle)}
        >
          {busyAction === 'google' ? (
            <ActivityIndicator size="small" color={c.text} />
          ) : (
            <View style={styles.socialInner}>
              <GoogleIcon size={16} />
              <Text style={[styles.socialBtnText, { color: c.text }]}>Google</Text>
            </View>
          )}
        </Pressy>

        <Pressy
          testID="register-apple"
          accessibilityLabel="Apple"
          disabled={busy}
          style={[
            styles.socialBtn,
            {
              height: socialBtnHeight,
              backgroundColor: c.bgCard,
              borderColor: c.border,
            },
          ]}
          onPress={() => void social('apple', signInWithApple)}
        >
          {busyAction === 'apple' ? (
            <ActivityIndicator size="small" color={c.text} />
          ) : (
            <View style={styles.socialInner}>
              <AppleIcon size={16} color={c.text} />
              <Text style={[styles.socialBtnText, { color: c.text }]}>Apple</Text>
            </View>
          )}
        </Pressy>
      </View>

      {/* Footer Link matching View #7 */}
      {!isGuest ? (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: c.textSecondary }]}>
            Already registered?{' '}
          </Text>
          <Pressy
            accessibilityLabel="Sign in"
            onPress={() => nav.replace('login')}
            hitSlop={8}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={[styles.footerLink, { color: c.accent }]}>Sign In</Text>
          </Pressy>
        </View>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    gap: 16,
  },
  inputGroup: {
    gap: 14,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    fontFamily: fonts.body.regular,
    fontSize: 12.5,
    flex: 1,
    lineHeight: 17,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  socialBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  socialBtnText: {
    fontFamily: fonts.body.semibold,
    fontSize: 13,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontFamily: fonts.body.regular,
    fontSize: 12.5,
  },
  footerLink: {
    fontFamily: fonts.body.semibold,
    fontSize: 12.5,
  },
});
