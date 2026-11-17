import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { useAuthStore, useIsGuest } from '../../store/authStore';
import { emailError, passwordValid, usernameError } from './authValidation';
import { PasswordRules } from './PasswordRules';

type Field = 'username' | 'email' | 'password' | 'confirm' | 'terms';

export const RegistrationScreen: React.FC<RootScreenProps<'registration'>> = () => {
  const c = useTheme();
  const { nav, back } = useAppNav();
  const isGuest = useIsGuest();
  const register = useAuthStore((s) => s.register);
  const upgradeGuest = useAuthStore((s) => s.upgradeGuest);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});
  const [busy, setBusy] = useState(false);

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

    setBusy(true);
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
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Create Account"
      onBack={back}
      testID="registration-screen"
      footer={<AppButton testID="register-submit" title={isGuest ? 'Create Account & Keep Progress' : 'Sign Up'} fullWidth loading={busy} onPress={submit} />}
    >
      {isGuest ? (
        <AppCard padding="sm">
          <Text style={[type.small, { color: c.textSecondary }]}>Your guest progress, coins and stats will be kept on your new account.</Text>
        </AppCard>
      ) : null}

      <AppCard style={{ gap: 12 }}>
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
          placeholder="e.g. TacticalAlex"
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
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 1.5,
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: terms ? c.accent : c.border,
                backgroundColor: terms ? c.accent : 'transparent',
              }}
            >
              {terms ? <Check size={14} color="#FFFFFF" /> : null}
            </View>
            <Text style={[type.small, { color: c.textSecondary, flex: 1 }]}>I agree to the Terms of Service and Fair Play Policy</Text>
          </Pressy>
          {errors.terms ? <Text style={[type.small, { color: c.danger }]}>{errors.terms}</Text> : null}
        </View>
      </AppCard>

      {errors.form ? (
        <Text testID="register-error" accessibilityRole="alert" style={[type.small, { color: c.danger }]}>
          {errors.form}
        </Text>
      ) : null}

      {!isGuest ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <Text style={[type.small, { color: c.textSecondary }]}>Already have an account?</Text>
          <Pressy accessibilityLabel="Sign in" onPress={() => nav.replace('login')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={[type.smallStrong, { color: c.accent }]}>Sign in</Text>
          </Pressy>
        </View>
      ) : null}
    </Screen>
  );
};
