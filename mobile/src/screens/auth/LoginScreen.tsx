import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Globe, Shield } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { toApiError, friendlyMessage } from '../../services/api/errors';
import { signInWithApple, signInWithGoogle, socialProviders } from '../../services/socialAuth';
import { useAuthStore, useIsGuest } from '../../store/authStore';
import { emailError } from './authValidation';

export const LoginScreen: React.FC<RootScreenProps<'login'>> = () => {
  const c = useTheme();
  const { nav, resetTo, back } = useAppNav();
  const signIn = useAuthStore((s) => s.signIn);
  const isGuest = useIsGuest();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passErr, setPassErr] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const eErr = emailError(email);
    const pErr = password ? null : 'Enter your password';
    setEmailErr(eErr);
    setPassErr(pErr);
    setFormErr(null);
    if (eErr || pErr) return;
    setBusy(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      resetTo('Main');
    } catch (e) {
      const err = toApiError(e);
      setFormErr(err.code === 'INVALID_CREDENTIALS' ? 'Wrong email or password.' : friendlyMessage(err));
      setBusy(false);
    }
  };

  const social = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setFormErr(null);
    try {
      await fn();
      resetTo('Main');
    } catch (e) {
      if (!(e instanceof Error && e.message === 'CANCELLED')) setFormErr(friendlyMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen title="Sign In" onBack={back} testID="login-screen">
      <View style={{ gap: 4 }}>
        <Text style={[type.headline, { color: c.text }]}>Welcome Back</Text>
        <Text style={[type.small, { color: c.textSecondary }]}>Sign in to continue your ranked streak.</Text>
      </View>

      {isGuest ? (
        <AppCard padding="sm">
          <Text style={[type.small, { color: c.textSecondary }]}>
            You are playing as a guest. To keep your current progress, create an account instead of signing in.
          </Text>
          <Pressy accessibilityLabel="Create account to keep progress" onPress={() => nav.navigate('registration')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={[type.smallStrong, { color: c.accent }]}>Create account and keep progress</Text>
          </Pressy>
        </AppCard>
      ) : null}

      <AppCard style={{ gap: 12 }}>
        <AppInput
          testID="login-email"
          label="Email Address"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setEmailErr(null);
            setFormErr(null);
          }}
          error={emailErr}
          placeholder="you@domain.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoCorrect={false}
        />
        <AppInput
          testID="login-password"
          label="Password"
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
        <View style={{ alignItems: 'flex-end' }}>
          <Pressy testID="login-forgot" accessibilityLabel="Forgot password" onPress={() => nav.navigate('forgot_password')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={[type.smallStrong, { color: c.accent }]}>Forgot Password?</Text>
          </Pressy>
        </View>
      </AppCard>

      {formErr ? (
        <Text testID="login-error" accessibilityRole="alert" style={[type.small, { color: c.danger }]}>
          {formErr}
        </Text>
      ) : null}

      <AppButton testID="login-submit" title="Sign In" fullWidth loading={busy} onPress={submit} />

      {socialProviders.google || socialProviders.apple ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {socialProviders.google ? (
            <AppButton
              testID="login-google"
              title="Google"
              variant="secondary"
              size="md"
              disabled={busy}
              icon={<Globe size={16} color={c.x} />}
              style={{ flex: 1 }}
              onPress={() => void social(signInWithGoogle)}
            />
          ) : null}
          {socialProviders.apple ? (
            <AppButton
              testID="login-apple"
              title="Apple"
              variant="secondary"
              size="md"
              disabled={busy}
              icon={<Shield size={16} color={c.text} />}
              style={{ flex: 1 }}
              onPress={() => void social(signInWithApple)}
            />
          ) : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <Text style={[type.small, { color: c.textSecondary }]}>Don't have an account?</Text>
        <Pressy testID="login-signup" accessibilityLabel="Create account" onPress={() => nav.navigate('registration')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[type.smallStrong, { color: c.accent }]}>Sign up</Text>
        </Pressy>
      </View>
    </Screen>
  );
};
