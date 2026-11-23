import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressy } from '../../components/common/Pressy';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage, toApiError } from '../../services/api/errors';
import { signInWithApple, signInWithGoogle, socialProviders } from '../../services/socialAuth';
import { useAuthStore, useIsGuest } from '../../store/authStore';
import { emailError, passwordValid, usernameError } from './authValidation';
import { PasswordRules } from './PasswordRules';
import { MUTED, ProtoButton, ProtoHeader, ProtoInput, ProtoScreen, SocialButton } from './protoUi';

type Field = 'username' | 'email' | 'password';

export const RegistrationScreen: React.FC<RootScreenProps<'registration'>> = () => {
  const c = useTheme();
  const { nav, resetTo, back } = useAppNav();
  const isGuest = useIsGuest();
  const register = useAuthStore((s) => s.register);
  const upgradeGuest = useAuthStore((s) => s.upgradeGuest);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<'google' | 'apple' | null>(null);

  const clear = (f: Field) => setErrors((e) => ({ ...e, [f]: undefined, form: undefined }));

  const submit = async () => {
    if (busy) return;
    const next: typeof errors = {};
    const u = usernameError(username);
    if (u) next.username = u;
    const em = emailError(email);
    if (em) next.email = em;
    if (!passwordValid(password)) next.password = 'Password does not meet the requirements below';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const input = { email: email.trim().toLowerCase(), password, username: username.trim() };
    try {
      // A guest keeps coins, stats and history: the same account is upgraded instead of creating a new one.
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

  const social = async (provider: 'google' | 'apple', fn: () => Promise<void>) => {
    if (busy || socialBusy) return;
    setSocialBusy(provider);
    setErrors({});
    try {
      await fn();
      resetTo('Main');
    } catch (e) {
      if (!(e instanceof Error && e.message === 'CANCELLED')) setErrors({ form: friendlyMessage(e) });
      setSocialBusy(null);
    }
  };

  return (
    <ProtoScreen testID="registration-screen">
      <ProtoHeader title="Create Account" onBack={back} />
      <View style={styles.body}>
        <View style={styles.fields}>
          <ProtoInput
            testID="register-username"
            label="Username"
            value={username}
            onChangeText={(t) => {
              setUsername(t);
              clear('username');
            }}
            error={errors.username}
            placeholder="@username"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
          <ProtoInput
            testID="register-email"
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              clear('email');
            }}
            error={errors.email}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
          />
          <ProtoInput
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
            onSubmitEditing={submit}
          />
        </View>

        <PasswordRules value={password} card />

        {errors.form ? (
          <Text testID="register-error" accessibilityRole="alert" style={[styles.error, { color: c.danger }]}>
            {errors.form}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <ProtoButton testID="register-submit" title="Create Account" loading={busy} onPress={submit} />
          {socialProviders.google || socialProviders.apple ? (
            <View style={styles.socialRow}>
              {socialProviders.google ? (
                <SocialButton testID="register-google" provider="google" busy={socialBusy === 'google'} disabled={busy || !!socialBusy} onPress={() => void social('google', () => signInWithGoogle({ upgradeGuest: isGuest }))} />
              ) : null}
              {/* Apple sign-in temporarily disabled:
              {socialProviders.apple ? (
                <SocialButton testID="register-apple" provider="apple" busy={socialBusy === 'apple'} disabled={busy || !!socialBusy} onPress={() => void social('apple', () => signInWithApple({ upgradeGuest: isGuest }))} />
              ) : null}
              */}
            </View>
          ) : null}
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: MUTED }]}>Already registered? </Text>
            <Pressy accessibilityLabel="Sign in" onPress={() => nav.replace('login')} hitSlop={10}>
              <Text style={[styles.footerLink, { color: c.accent }]}>Sign In</Text>
            </Pressy>
          </View>
        </View>
      </View>
    </ProtoScreen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14 },
  fields: { gap: 10 },
  error: { fontFamily: fonts.body.regular, fontSize: 11.5, lineHeight: 16 },
  footer: { marginTop: 'auto', paddingTop: 8, gap: 8 },
  socialRow: { flexDirection: 'row', gap: 10 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  footerText: { fontFamily: fonts.body.regular, fontSize: 11 },
  footerLink: { fontFamily: fonts.body.semibold, fontSize: 11 },
});
