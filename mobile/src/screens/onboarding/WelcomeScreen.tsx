import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Globe, Mail, Shield } from 'lucide-react-native';
import { AppButton } from '../../components/common/AppButton';
import { Pressy } from '../../components/common/Pressy';
import { Screen } from '../../components/common/Screen';
import { SymbolMark } from '../../components/game/SymbolMark';
import { fonts, type } from '../../design-system/typography';
import { useTheme } from '../../hooks/useTheme';
import { useAppNav } from '../../navigation/useAppNav';
import type { RootScreenProps } from '../../navigation/types';
import { friendlyMessage } from '../../services/api/errors';
import { signInWithApple, signInWithGoogle, socialProviders } from '../../services/socialAuth';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';

type Action = 'google' | 'apple' | 'guest';

export const WelcomeScreen: React.FC<RootScreenProps<'welcome'>> = () => {
  const c = useTheme();
  const { nav, resetTo } = useAppNav();
  const [busy, setBusy] = useState<Action | null>(null);

  const run = async (action: Action, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(action);
    try {
      await fn();
      resetTo('Main');
    } catch (e) {
      if (!(e instanceof Error && e.message === 'CANCELLED')) toast.error('Sign-in failed', friendlyMessage(e));
      setBusy(null);
    }
  };

  const showApple = Platform.OS !== 'android' && socialProviders.apple;

  return (
    <Screen testID="welcome-screen" contentStyle={{ flexGrow: 1, justifyContent: 'space-between' }}>
      <View style={styles.hero}>
        <View style={[styles.logo, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <SymbolMark value="X" size="md" />
          <SymbolMark value="O" size="md" />
        </View>
        <Text style={[styles.title, { color: c.text }]}>Welcome to Tic Tac Toe</Text>
        <Text style={[type.body, { color: c.textSecondary, textAlign: 'center' }]}>Sign in to sync rankings, friends, and rewards.</Text>
      </View>

      <View style={{ gap: 12 }}>
        {socialProviders.google ? (
          <AppButton testID="welcome-google" title="Continue with Google" variant="secondary" fullWidth icon={<Globe size={16} color={c.accentSecondary} />} loading={busy === 'google'} disabled={!!busy} onPress={() => run('google', signInWithGoogle)} />
        ) : null}
        {showApple ? (
          <AppButton testID="welcome-apple" title="Continue with Apple" variant="secondary" fullWidth icon={<Shield size={16} color={c.text} />} loading={busy === 'apple'} disabled={!!busy} onPress={() => run('apple', signInWithApple)} />
        ) : null}
        <AppButton testID="welcome-email" title="Sign in with Email" fullWidth icon={<Mail size={16} color="#FFFFFF" />} disabled={!!busy} onPress={() => nav.navigate('login')} />
        <View style={styles.or}>
          <View style={[styles.line, { backgroundColor: c.border }]} />
          <Text style={[type.small, { color: c.textSecondary }]}>or</Text>
          <View style={[styles.line, { backgroundColor: c.border }]} />
        </View>
        <AppButton testID="welcome-guest" title="Continue as Guest" variant="outline" fullWidth loading={busy === 'guest'} disabled={!!busy} onPress={() => run('guest', () => useAuthStore.getState().continueAsGuest())} />
      </View>

      <View style={styles.footer}>
        <Text style={[type.small, { color: c.textSecondary }]}>New player? </Text>
        <Pressy testID="welcome-register" accessibilityLabel="Create an account" onPress={() => nav.navigate('registration')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[type.smallStrong, { color: c.accent }]}>Create an account</Text>
        </Pressy>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 12, paddingTop: 24 },
  logo: { width: 80, height: 80, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { fontFamily: fonts.display.bold, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
