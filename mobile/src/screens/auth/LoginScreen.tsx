import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressy } from '../../components/common/Pressy';
import { fonts } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { toApiError, friendlyMessage } from '../../services/api/errors';
import { signInWithApple, signInWithGoogle, socialProviders } from '../../services/socialAuth';
import { useAuthStore } from '../../store/authStore';
import { emailError } from './authValidation';
import { ProtoButton, ProtoHeader, ProtoInput, ProtoScreen, SocialButton } from './protoUi';

import { fs } from '../../design-system/responsive';
export const LoginScreen: React.FC<RootScreenProps<'login'>> = () => {
  const c = useTheme();
  const { nav, resetTo, back } = useAppNav();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passErr, setPassErr] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'submit' | 'google' | 'apple' | null>(null);
  const busy = busyAction !== null;

  const submit = async () => {
    if (busy) return;
    const eErr = emailError(email);
    const pErr = password ? null : 'Enter your password';
    setEmailErr(eErr);
    setPassErr(pErr);
    setFormErr(null);
    if (eErr || pErr) return;
    setBusyAction('submit');
    try {
      await signIn(email.trim().toLowerCase(), password);
      resetTo('Main');
    } catch (e) {
      const err = toApiError(e);
      setFormErr(err.code === 'INVALID_CREDENTIALS' ? 'Wrong email or password.' : friendlyMessage(err));
      setBusyAction(null);
    }
  };

  const social = async (action: 'google' | 'apple', fn: () => Promise<void>) => {
    if (busy) return;
    setBusyAction(action);
    setFormErr(null);
    try {
      await fn();
      resetTo('Main');
    } catch (e) {
      if (!(e instanceof Error && e.message === 'CANCELLED')) setFormErr(friendlyMessage(e));
      setBusyAction(null);
    }
  };

  return (
    <ProtoScreen testID="login-screen">
      <ProtoHeader title="Sign In" onBack={back} />
      <View style={styles.body}>
        <View>
          <Text style={[styles.title, { color: c.text }]}>Welcome back</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>Sign in to play ranked and see your friends.</Text>
        </View>

        <View style={styles.fields}>
          <ProtoInput
            testID="login-email"
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setEmailErr(null);
              setFormErr(null);
            }}
            error={emailErr}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
          />
          <ProtoInput
            testID="login-password"
            label="Password"
            placeholder="Your password"
            labelRight={
              <Pressy testID="login-forgot" accessibilityLabel="Forgot password" onPress={() => nav.navigate('forgot_password')} hitSlop={10}>
                <Text style={[styles.link, { color: c.accent }]}>Forgot password?</Text>
              </Pressy>
            }
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setPassErr(null);
              setFormErr(null);
            }}
            error={passErr}
            secureToggle
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={submit}
            returnKeyType="go"
          />
        </View>

        {formErr ? (
          <Text testID="login-error" accessibilityRole="alert" style={[styles.error, { color: c.danger }]}>
            {formErr}
          </Text>
        ) : null}

        <ProtoButton testID="login-submit" title="Sign In" loading={busyAction === 'submit'} onPress={submit} />

        <View style={styles.socialRow}>
          {socialProviders.google ? (
            <SocialButton testID="login-google" provider="google" busy={busyAction === 'google'} disabled={busy} onPress={() => void social('google', signInWithGoogle)} />
          ) : null}
          {/* Apple sign-in temporarily disabled:
          {socialProviders.apple ? (
            <SocialButton testID="login-apple" provider="apple" busy={busyAction === 'apple'} disabled={busy} onPress={() => void social('apple', signInWithApple)} />
          ) : null}
          */}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: c.textSecondary }]}>New to Tic-Tac-Toe? </Text>
          <Pressy testID="login-signup" accessibilityLabel="Create Account" onPress={() => nav.navigate('registration')} hitSlop={10}>
            <Text style={[styles.footerLink, { color: c.accent }]}>Create Account</Text>
          </Pressy>
        </View>
      </View>
    </ProtoScreen>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14 },
  title: { fontFamily: fonts.body.semibold, fontSize: fs(19), lineHeight: Math.round(fs(19) * 1.3), letterSpacing: -0.38 },
  sub: { fontFamily: fonts.body.regular, fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.3), marginTop: 4 },
  fields: { gap: 12 },
  link: { fontFamily: fonts.body.semibold, fontSize: fs(12) },
  error: { fontFamily: fonts.body.regular, fontSize: fs(12), lineHeight: Math.round(fs(12) * 1.3) },
  socialRow: { flexDirection: 'row', gap: 10 },
  footer: { marginTop: 'auto', paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  footerText: { fontFamily: fonts.body.regular, fontSize: fs(12) },
  footerLink: { fontFamily: fonts.body.semibold, fontSize: fs(12) },
});
